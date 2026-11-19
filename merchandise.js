const item = (id,label,swatch) => ({id,label,swatch});
const palette = (id,label,colours) => ({
  id,label,colours,swatch:'linear-gradient(90deg,'+colours.map((c,i)=>c+' '+(i/colours.length*100)+'% '+((i+1)/colours.length*100)+'%').join(',')+')'
});

export const collections = [
  palette('jewel','Jewel tones',['#a62d4d','#15786e','#c98225','#603982','#275784','#ac443b','#8a7138']),
  palette('bridal','Bridal reds',['#9b1c37','#aa4036','#6a1832','#c48240','#b83559','#a65839','#e2bb74']),
  palette('monsoon','Monsoon blues',['#2e657e','#306268','#405393','#617e92','#254b66','#479b99','#8396b5']),
  palette('pastel','Pastel garden',['#ddb4b7','#b7b9dd','#c4d4bd','#dfc5a3','#a4c3cb','#ceacbc','#dbcb9e']),
  palette('festival','Festival brights',['#ce3741','#d68c18','#bd367c','#3b9057','#3969ac','#9752ac','#c1522d']),
  palette('earth','Earth & madder',['#944d38','#b36b41','#8e6549','#aca573','#534b50','#d5b880','#6c7257']),
  palette('heritage','Forest & wine',['#374f40','#812942','#375c61','#7f573a','#a98c51','#493b55','#9b5859']),
  palette('ivory','Ivory & gold',['#e6d9bd','#cdae78','#ebd9c6','#d1be96','#b09b75','#dfc39b','#c7bb9f']),
  palette('orchid','Orchid & plum',['#63395d','#aa708f','#805080','#b399b8','#945a8f','#a45376','#57435b']),
  palette('spice','Marigold & spice',['#e1a036','#be6e32','#ad442d','#cd7c45','#9c5d3b','#d8ad4d','#a06c30']),
  palette('pearl','Pearl & graphite',['#e1dfd5','#999a96','#58595e','#c9c3bc','#8d8c92','#b4b2b9','#6d726d']),
  palette('coast','Coastal greens',['#356a76','#6fa9a0','#a8c5b2','#336d5a','#83a693','#518887','#b7c39c'])
];
export const dyes=[
  ['ruby','Ruby','#a22b46'],['peacock','Peacock','#14776b'],['indigo','Indigo','#364786'],['marigold','Marigold','#d29932'],
  ['ivory','Ivory','#e7dcc6'],['plum','Plum','#794469'],['emerald','Emerald','#276048'],['coral','Coral','#bd6559'],
  ['turquoise','Turquoise','#369599'],['copper','Copper','#a35f3c'],['rose','Dusty rose','#c294a0'],['navy','Midnight','#283653'],
  ['lilac','Lilac','#ab93bd'],['wine','Oxblood','#792a35'],['bronze','Antique gold','#a78847'],['graphite','Graphite','#51535a'],
  ['sky','Sky blue','#88afc5'],['mint','Mint','#9abdab'],['magenta','Magenta','#a73171'],['aubergine','Aubergine','#4d344e']
].map(row=>item(...row));
export const fabrics=[
  {id:'silk',label:'Woven silk',swatch:'#a98573',rough:.48,sheen:.63,sheenRough:.48,metal:.035},
  {id:'satin',label:'Silk satin',swatch:'linear-gradient(120deg,#8d7474,#f1d6c7,#907273)',rough:.27,sheen:.90,sheenRough:.23,metal:.06},
  {id:'cotton',label:'Handloom cotton',swatch:'#b9ab96',rough:.93,sheen:.14,sheenRough:.88,metal:0},
  {id:'tussar',label:'Tussar silk',swatch:'#b49968',rough:.63,sheen:.49,sheenRough:.58,metal:.02},
  {id:'velvet',label:'Velvet',swatch:'#755a74',rough:.86,sheen:1,sheenRough:.36,metal:0},
  {id:'linen',label:'Linen blend',swatch:'#c4b7a4',rough:.85,sheen:.28,sheenRough:.73,metal:0}
];
export const motifs=[
  item('buti','Zari buti','#ad8c55'),item('check','Woven checks','repeating-conic-gradient(#675b50 0 25%,#cfbd94 0 50%) 0 0/8px 8px'),
  item('stripe','Pinstripes','repeating-linear-gradient(90deg,#736657 0 3px,#d1b781 3px 4px)'),
  item('diamond','Diamond lattice','repeating-conic-gradient(from 45deg,#a18d68 0 25%,#e0cca4 0 50%) 0 0/9px 9px'),
  item('dot','Fine dots','radial-gradient(#f3d592 18%,transparent 21%) 0 0/6px 6px,#766453'),
  item('floral','Floral sprigs','#9c795f'),item('plain','Plain with border','#bcab87')
];
export const seats=[
  ['saddle','Saddle tan','#c99b6c'],['forest','Forest green','#446552'],['oat','Oat linen','#cfbd9d'],['cognac','Cognac','#a46543'],
  ['ink','Ink blue','#414b61'],['wine','Mulberry','#834557'],['pebble','Pebble grey','#96938f'],['black','Soft black','#3b3937'],
  ['blush','Blush','#c99591'],['ochre','Ochre','#b38947']
].map(row=>item(...row));
