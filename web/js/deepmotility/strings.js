// English strings of the Deep-Motility tool; merged into i18n.js's table (keys start with "dm" or "help_deepmotility").
export const strings = {
  dmRefine: "Refine with Deep-Motility",
  dmRefineHint: "Run the Deep-Motility networks on this image and show their outline as a proposal",
  dmDownloadConfirm: "Deep-Motility needs to download its models once ({mb} MB). They are kept in this browser for offline use. Download now?",
  dmDownload: "Download",
  dmDownloading: "Downloading the Deep-Motility models…",
  dmRunning: "Running Deep-Motility…",
  dmProposal: "Deep-Motility proposal",
  dmProposalLine: "{klass} · {conf}% confidence · {area}",
  dmProposalClassDiffers: "Deep-Motility suggests a different class ({klass}).",
  dmProposalEmpty: "Deep-Motility found no growth region.",
  dmAccept: "Accept",
  dmAcceptOutline: "Outline only",
  dmAcceptOutlineHint: "Use the proposed outline and keep the current class",
  dmDiscard: "Discard",
  dmAccepted: "Deep-Motility result applied. Undo reverts it.",
  dmLegend: "Deep-Motility proposal",
  dmUnsupported: "This browser cannot run Deep-Motility (needs Web Workers, WebAssembly and the Cache API).",
  dmFailed: "Deep-Motility is not available: {msg}",
  dmFallback: "Deep-Motility models are not downloaded; the built-in analyzer was used.",

  // settings
  dmAnalyzer: "Automatic analysis",
  dmAnalyzerLead: "Choose which method analyses new images. You can always refine one image with Deep-Motility from its review page.",
  dmAnalyzerBuiltin: "Built-in (fast, small, always offline)",
  dmAnalyzerBuiltinHelp: "Plate detection + a small pixel classifier. About 0.1 s per image.",
  dmAnalyzerDeep: "Deep-Motility (more accurate)",
  dmAnalyzerDeepHelp: "Compact versions of the MotilityJ deep networks. One-time download of {mb} MB; about {s} s per image on a computer.",
  dmModelState: "Deep-Motility models:",
  dmModelReady: "downloaded",
  dmModelMissing: "not downloaded",
  dmRemove: "Remove models",
  dmRemoved: "Deep-Motility models removed.",

  // help
  help_deepmotility_title: "Deep-Motility refinement",
  help_deepmotility_html: `<p>MotilityJ can also run compact versions of the deep networks of the original MotilityJ (Deep-Motility: an HRNet that segments the growth and a ResNet-50 that tells complete from incomplete plates). They were distilled into two small MobileNet networks that run in your browser; nothing is sent to a server.</p>
  <ul>
    <li><b>Refine with Deep-Motility</b> on the review page runs them on the current image and draws their outline as a dashed yellow <b>proposal</b>. <b>Accept</b> applies the outline and the suggested class, <b>Outline only</b> keeps your class, <b>Discard</b> hides it. <b>Undo</b> reverts an accepted proposal.</li>
    <li>The first use downloads the models and the runtime (about 27 MB, once). They are kept in this browser and work offline afterwards; <a href="#/settings">Settings</a> shows them and can remove them.</li>
    <li>In <a href="#/settings">Settings</a> you can make Deep-Motility the method used by <b>Analyse</b> for new images. It is more accurate than the built-in analyzer, especially for complete/incomplete, but slower (about half a second per image on a computer, an estimated 1–2 s on a phone).</li>
    <li>The outline is the biggest segmented region with its holes filled, like in the Java MotilityJ. The plate circle still comes from the built-in plate detection.</li>
  </ul>`,
};
