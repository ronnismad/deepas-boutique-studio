# Deepa’s Boutique Studio

[Open the interactive 3D boutique designer](https://ronnismad.github.io/deepas-boutique-studio/).

Explore the measured shop in ten views, including the sliding entrance, cash desk, saree shelf, window mannequins and mezzanine doorway. The original pillars, openings and cabinetry are fixed to the plan.

- **Finishes** includes 18 floors, 26 wall palettes, custom paints, 14 timbers, 10 countertops, eight metal finishes and ten stool colours.
- **Displays** lets you choose a shelf collection, dress the two mannequins independently and compare fabric finishes and woven motifs.
- **Lighting** includes twelve layouts with controls for warmth, daylight, fixture brightness, shelf lighting, window and cash-desk circuits, and beam width.
- **Designs** includes fourteen starting points, A/B comparison slots, named saves and design-file import and export. Undo and redo work across design changes. The image export saves the current camera as a PNG.

Use **Auto quality** for everyday editing, **Fast preview** on a slower device or **Fine detail** for a still view. **Ray trace** refines the current camera progressively. Browser-saved designs from the earlier release open with defaults for the new settings.

The published `index.html` is self-contained and can also be opened offline in a browser with WebGL support.

## Rebuild

Install Node.js and Python 3, then run the following commands in the repository.

```sh
npm ci
npm run build
```

GitHub Pages serves the root of the `main` branch. After editing the source, rebuild and commit the updated `index.html` with your changes.
