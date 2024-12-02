figma.showUI(__html__, { width: 450, height: 550 });

function convertToElementor() {
  try {
    var selection = figma.currentPage.selection;
    var nodesToProcess = selection;

    if (selection.length === 0) {
      var desktopFrame = figma.currentPage.findOne(function (node) {
        return (
          node.type === "FRAME" && node.name.toLowerCase().includes("desktop")
        );
      });

      if (desktopFrame) {
        nodesToProcess = [desktopFrame];
      } else {
        throw new Error(
          "Please select elements to convert or ensure a Desktop frame exists"
        );
      }
    }

    figma.ui.postMessage({
      type: "conversion-start",
      total: getTotalNodes(nodesToProcess),
    });

    var elementorData = processData(nodesToProcess);
    var compactData = createCompactJSON(elementorData);

    figma.ui.postMessage({
      type: "conversion-complete",
      data: compactData,
    });
  } catch (error) {
    console.error("Conversion error:", error);
    figma.ui.postMessage({
      type: "conversion-error",
      message: error.message,
    });
  }
}

function getTotalNodes(nodes) {
  var total = 0;
  for (var i = 0; i < nodes.length; i++) {
    total++;
    if (nodes[i].children) {
      total += getTotalNodes(nodes[i].children);
    }
  }
  return total;
}

function processData(nodes) {
  return {
    type: "elementor",
    siteurl: "",
    elements: processElements(nodes),
  };
}

function processElements(nodes) {
  var elements = [];
  var processed = 0;
  var total = getTotalNodes(nodes);

  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    var element = processElement(node);
    if (element) {
      elements.push(element);
    }
    processed++;
    updateProgress(processed, total);
  }

  return elements;
}

function updateProgress(processed, total) {
  figma.ui.postMessage({
    type: "conversion-progress",
    processed: processed,
    total: total,
  });
}

function generateUniqueId() {
  return Math.random().toString(36).substr(2, 9);
}

function processElement(node) {
  if (!node) return null;

  // if (isImageElement(node)) {
  //   return createImageElement(node);
  // }

  var element = {
    id: generateUniqueId(),
    elType: getElementType(node),
    isInner: false,
    isLocked: node.locked || false,
    settings: getElementSettings(node),
    elements: [],
  };

  if (node.children && node.children.length > 0) {
    element.elements = processElements(node.children);
  }

  return element;
}

function getElementType(node) {
  if (!node.type) return "widget";

  var typeMap = {
    TEXT: "widget",
    FRAME: node.layoutMode ? "container" : "section",
    GROUP: "container",
    RECTANGLE: "widget",
    INSTANCE: "container",
    COMPONENT: "container",
  };

  return typeMap[node.type] || "widget";
}

function getElementSettings(node) {
  var settings = getBaseSettings(node);

  if (node.type === "TEXT") {
    Object.assign(settings, getTextSettings(node));
  }

  if (node.fills && node.fills.length > 0) {
    Object.assign(settings, getBackgroundSettings(node));
  }

  if (node.layoutMode) {
    Object.assign(settings, getLayoutSettings(node));
  }

  return settings;
}

function getBaseSettings(node) {
  return {
    container_type: "flex",
    content_width: "full",
    width: {
      unit: "px",
      size: Math.round(node.width || 0),
      sizes: [],
    },
    height: {
      unit: "px",
      size: Math.round(node.height || 0),
      sizes: [],
    },
    padding: getSpacing(node),
    margin: getSpacing(node),
  };
}

function getTextSettings(node) {
  return {
    widgetType: "heading",
    title: node.characters || "",
    align: getTextAlignment(node),
    typography_typography: "custom",
    typography_font_family: getFontFamily(node),
    typography_font_size: {
      unit: "px",
      size: node.fontSize || 16,
      sizes: [],
    },
    typography_font_weight: getFontWeight(node),
    typography_line_height: {
      unit: "px",
      size: getLineHeight(node),
      sizes: [],
    },
    title_color: getTextColor(node),
  };
}

function getFontWeight(node) {
  if (node.fontName && node.fontName.style) {
    return node.fontName.style.toLowerCase();
  }
  return "normal";
}

function getLineHeight(node) {
  if (node.lineHeight) return node.lineHeight;
  return node.fontSize || 16;
}

function getTextColor(node) {
  var fill = node.fills[0];
  if (fill.type === "SOLID") {
    return getRGBAColor(fill);
  }
  return "#000000";
}

function getTextAlignment(node) {
  if (!node.textAlignHorizontal) return "left";
  return node.textAlignHorizontal.toLowerCase();
}

function getLayoutSettings(node) {
  return {
    flex_direction: node.layoutMode === "HORIZONTAL" ? "row" : "column",
    flex_wrap: node.layoutWrap === "WRAP" ? "wrap" : "nowrap",
    flex_gap: {
      unit: "px",
      size: node.itemSpacing || 0,
      column: node.itemSpacing || 0,
      row: node.itemSpacing || 0,
      isLinked: true,
    },
  };
}

function getFontFamily(node) {
  if (!node.fontName || !node.fontName.family) return "default";
  return node.fontName.family;
}

function getImageAlignment(node) {
  if (!node.constraints) return "left";

  var horizontal = node.constraints.horizontal || "LEFT";
  var vertical = node.constraints.vertical || "TOP";

  if (horizontal === "CENTER" && vertical === "CENTER") return "center";
  if (horizontal === "RIGHT") return "right";
  return "left";
}

function getBackgroundSettings(node) {
  var fill = node.fills[0];
  if (fill.type === "SOLID") {
    return {
      background_background: "classic",
      background_color: getRGBAColor(fill),
    };
  }
  return {};
}

function getRGBAColor(fill) {
  if (!fill || !fill.color) return "rgba(0,0,0,1)";
  var r = Math.round(fill.color.r * 255);
  var g = Math.round(fill.color.g * 255);
  var b = Math.round(fill.color.b * 255);
  var a = fill.opacity || 1;
  return "rgba(" + r + "," + g + "," + b + "," + a + ")";
}

function getSpacing(node) {
  return {
    unit: "px",
    top: Math.round(node.paddingTop || 0),
    right: Math.round(node.paddingRight || 0),
    bottom: Math.round(node.paddingBottom || 0),
    left: Math.round(node.paddingLeft || 0),
    isLinked: false,
  };
}

function createCompactJSON(data) {
  return JSON.stringify(data, function (key, value) {
    if (value === null || value === undefined || value === "") {
      return undefined;
    }
    return value;
  });
}

function minifyJson(obj) {
  return JSON.stringify(obj).replace(/[\s\t\n\r]+/g, "");
}

figma.ui.onmessage = function (msg) {
  if (msg.type === "convert") {
    convertToElementor();
  } else if (msg.type === "copy") {
    try {
      // Format data untuk Elementor
      const formattedData = {
        type: "elementor",
        siteurl: "",
        elements: msg.data.elements || [],
      };

      // Minify JSON dan hapus whitespace
      const minifiedJson = JSON.stringify(formattedData)
        .replace(/[\s\t\n\r]+/g, "")
        .replace(/":"/g, '":"')
        .replace(/","/g, '","')
        .replace(/\[\{/g, "[{")
        .replace(/\}\]/g, "}]")
        .replace(/\}\,\{/g, "},{");

      // Kirim kembali data yang sudah diminify
      figma.ui.postMessage({
        type: "copy-data",
        data: minifiedJson,
      });
    } catch (error) {
      figma.ui.postMessage({
        type: "copy-error",
        message: "Failed to format JSON data",
      });
    }
  }
};
