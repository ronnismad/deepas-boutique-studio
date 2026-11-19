from pathlib import Path
import argparse, json, struct, hashlib, base64, subprocess
wd = Path(__file__).resolve().parent
assets = wd / 'assets'
cli = argparse.ArgumentParser(description='Build the standalone boutique designer.')
cli.add_argument('--copy-to', type=Path, help='Also save the finished page at this path.')
args = cli.parse_args()
chunks=[];digests={};models={}
def chunk(data):
    digest=hashlib.sha256(data).digest()
    if digest not in digests:
        digests[digest]=len(chunks)
        chunks.append(base64.b64encode(data).decode('ascii'))
    return digests[digest]
for mode in ['recessed','cove','track']:
    raw=(assets/'models'/f'Boutique-{mode}.glb').read_bytes()
    js_len=struct.unpack_from('<I',raw,12)[0]
    doc=json.loads(raw[20:20+js_len])
    start=28+js_len
    cuts=sorted(set([0,start,len(raw)]+[start+b.get('byteOffset',0) for b in doc['bufferViews']]+[start+b.get('byteOffset',0)+b['byteLength'] for b in doc['bufferViews']]))
    segments=[]
    for a,b in zip(cuts,cuts[1:]):
        if b<=a: continue
        content=raw[a:b]
        if len(content)<8 and content==bytes(len(content)):continue
        segments.append([a,chunk(content)])
    models[mode]={'length':len(raw),'segments':segments}
    test=bytearray(len(raw))
    for at,k in segments:
        data=base64.b64decode(chunks[k])
        test[at:at+len(data)]=data
    assert bytes(test)==raw
def picture(name):
    return base64.b64encode((assets / 'previews' / (name + '.jpg')).read_bytes()).decode('ascii')

references = {k: picture(k) for k in ('diffuse', 'track', 'rose', 'oxide', 'teal', 'terrazzo')}
bundle="const esbuild = require('esbuild');const result = esbuild.buildSync({entryPoints:['view.js'],nodePaths:[require('path').resolve(require.resolve('esbuild/package.json'),'../..')],bundle:true,minify:true,write:false});process.stdout.write(result.outputFiles[0].contents);"
render=subprocess.check_output(['node','-e',bundle],cwd=wd).decode('utf-8').replace('</script','<\\/script')
html=(wd/'studio.template.html').read_text(encoding='utf-8-sig').replace('__BUNDLE__',render).replace('__MODEL_DATA__',json.dumps(dict(models=models,chunks=chunks),separators=(',',':'))).replace('__REFERENCE_DATA__',json.dumps(references,separators=(',',':'))).replace('__POSTER__',picture('fallback'))
assert all(x not in html for x in ['__MODEL_DATA__','__REFERENCE_DATA__','__BUNDLE__','__POSTER__'])
for dest in dict.fromkeys(p for p in (wd / 'index.html', args.copy_to) if p is not None):
    candidate = dest.with_suffix('.html.tmp')
    candidate.write_text(html, encoding='utf-8')
    candidate.replace(dest)
    print('Built', dest, dest.stat().st_size, 'bytes')
