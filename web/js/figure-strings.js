// English strings of the figure builder (figure-ui.js); merged into i18n.js's table (keys start with "fig" or "help_figure").
export const strings = {
  figItem: "Figure (PNG/SVG)…", figSeriesButton: "Figure",
  figTitle: "Publication figure", figPreview: "Figure preview",
  figNoAnalysed: "Analyse some images first: the figure shows analysed plates.",
  figEmpty: "No image matches these options.",
  figContent: "Content", figRowsBy: "Rows", figColsBy: "Columns", figStrainCondition: "Strain · condition", figSeries: "Series",
  figReplicates: "Replicates", figTimePoints: "Time points",
  figTimeHint: "{n} of {total} images have a time (series time or incubation time).",
  figImages: "Images", figRepresentative: "Representative (closest to the mean)", figAll: "All replicates", figManual: "Choose by hand",
  figRepBy: "Representative by", figMaxCols: "Maximum columns", figTranspose: "Orientation", figTransposeAuto: "Automatic (one row when there is one image per group)", figTransposeNo: "Groups as rows", figTransposeYes: "Groups as columns",
  figPanels: "Panels", figNormalize: "Scale", figSamePlate: "Same plate size in every panel", figSameMm: "Same mm per figure mm",
  figCropMargin: "Margin around the plate (%)", figMaskPlate: "Hide outside the plate",
  figOutline: "Growth outline", figPlateCircle: "Plate circle", figScaleBar: "Scale bar", figScaleBarAll: "Scale bar on every panel",
  figText: "Text", figLabels: "Panel letters (A, B, C…)", figRowHeaders: "Row headers", figColHeaders: "Column headers",
  figCaption: "Caption under each panel", figNone: "None", figFontPt: "Font size (pt)", figBackground: "Background",
  figWhite: "White", figBlack: "Black",
  figTable: "Table", figTableShow: "n and mean ± SD of each row", figTableMeasure: "Measure",
  figTableHint: "Computed over every analysed image of the row, not only the panels shown.",
  figGroup: "Group", figMeanSd: "{m}, mean ± SD", figRepN: "Replicate {n}",
  figOutput: "Output", figWidth: "Width", figDpi: "PNG resolution (dpi)",
  figSizeInfo: "{w} × {h} mm · PNG {pw} × {ph} px · {n} panel(s)",
  figTooLarge: "The PNG would be {w} × {h} pixels: reduce the width or the resolution.",
  figRendering: "Rendering the figure…", figClose: "Close",
  help_figure_title: "Publication figures",
  help_figure_html: `<p><b>Export › Figure (PNG/SVG)…</b> on an experiment (or <b>Figure</b> on a series) builds a figure of plate photos as in motility papers: one row per condition (or strain, or series) and one column per replicate or time point.</p>
  <ul>
    <li><b>Images</b>: by default one <b>representative</b> plate per condition, the replicate whose measure (equivalent diameter by default) is closest to the condition mean; or every replicate; or choose them by hand.</li>
    <li>Each panel is cropped to the <b>plate circle</b> with a small margin. <b>Same plate size</b> makes every plate equally large; <b>same mm per figure mm</b> keeps one common scale, so a smaller dish looks smaller.</li>
    <li>The <b>scale bar</b> (10 mm by default) is computed from the scale of each image (plate diameter, or the manual px/mm of Settings). It is drawn on the first panel when every panel has the same scale, and on every panel otherwise.</li>
    <li>Panel letters, row and column headers (from the metadata), a caption with a measurement, the growth outline and the plate circle are optional; so is a table with <b>n and mean ± SD</b> of each row, computed over all analysed images of that row.</li>
    <li><b>SVG</b> keeps text and outlines as vectors (the photos are embedded as JPEG) and opens in Inkscape, Illustrator or PowerPoint; <b>PNG</b> is rendered at the chosen width and resolution (e.g. 180 mm at 300 dpi = 2126 px wide) and records that resolution in the file.</li>
  </ul>`,
};
