// Narrow browser integration for Alicorn's semantic snapshot. Odin supplies
// the semantic model and actions; this file only maintains stable DOM nodes
// and maps browser-native focus/activation to the host's listeners.
(() => {
  const trees = new Map();

  const setAttribute = (element, name, value) => {
    if (value === null || value === undefined || value === "") {
      if (element.hasAttribute(name)) element.removeAttribute(name);
      return;
    }
    value = String(value);
    if (element.getAttribute(name) !== value) element.setAttribute(name, value);
  };

  const elementFor = (node) => {
    switch (node.role) {
      case "button": return ["button", "button"];
      case "textbox": return [node.multiline ? "textarea" : "input", "textbox"];
      case "checkbox": return ["input", "checkbox"];
      case "slider": return ["input", "slider"];
      case "tab": return ["button", "tab"];
      case "option": return ["div", "option"];
      default: return ["div", node.role];
    }
  };

  const ensureElement = (tree, node) => {
    let element = tree.nodes.get(node.id);
    const [tag, role] = elementFor(node);
    if (element && element.localName !== tag) {
      const replacement = document.createElement(tag);
      replacement.id = node.id;
      element.replaceWith(replacement);
      tree.nodes.set(node.id, replacement);
      element = replacement;
    }
    if (!element) {
      element = document.createElement(tag);
      element.id = node.id;
      tree.nodes.set(node.id, element);
    }
    if (tag === "button") element.type = "button";
    if (tag === "input") {
      if (role === "checkbox") element.type = "checkbox";
      else if (role === "slider") element.type = "range";
      else element.type = "text";
    }
    setAttribute(element, "role", role === "generic" ? null : role);
    return element;
  };

  const patchElement = (element, node) => {
    setAttribute(element, "aria-label", node.label);
    setAttribute(element, "aria-description", node.description);
    setAttribute(element, "aria-disabled", node.disabled ? "true" : null);
    setAttribute(element, "aria-checked", node.role === "checkbox" ? (node.checked ? "true" : "false") : null);
    setAttribute(element, "aria-selected", ["tab", "option", "treeitem"].includes(node.role) ? (node.selected ? "true" : "false") : null);
    setAttribute(element, "aria-expanded", (node.canExpand || node.canCollapse) ? (node.expanded ? "true" : "false") : null);
    setAttribute(element, "aria-readonly", node.readOnly ? "true" : null);
    setAttribute(element, "aria-required", node.required ? "true" : null);
    setAttribute(element, "aria-invalid", node.invalid ? "true" : null);
    setAttribute(element, "aria-busy", node.busy ? "true" : null);
    setAttribute(element, "aria-current", node.current ? "true" : null);
    setAttribute(element, "aria-live", node.live === "off" ? null : node.live);
    setAttribute(element, "aria-atomic", node.liveAtomic ? "true" : null);
    setAttribute(element, "aria-posinset", node.positionInSet);
    setAttribute(element, "aria-setsize", node.sizeOfSet);
    setAttribute(element, "aria-activedescendant", node.currentId && node.currentId !== node.id ? node.currentId : null);
    setAttribute(element, "aria-valuenow", node.hasNumericValue ? node.numericValue : null);
    setAttribute(element, "aria-valuemin", node.hasNumericValue ? node.numericMinimum : null);
    setAttribute(element, "aria-valuemax", node.hasNumericValue ? node.numericMaximum : null);
    setAttribute(element, "data-alicorn-modified", node.modified ? "true" : null);

    if ("disabled" in element) element.disabled = !!node.disabled;
    if (node.role === "checkbox") element.checked = !!node.checked;
    if (node.role === "textbox") element.readOnly = !!node.readOnly;
    if (node.role === "slider" && node.hasNumericValue) {
      element.min = String(node.numericMinimum);
      element.max = String(node.numericMaximum);
      element.step = String(node.numericStep || 1);
      element.value = String(node.numericValue);
    }
    if (node.role === "textbox") {
      const value = String(node.value || "");
      if (element.value !== value && !element.__alicornComposing) {
        const active = document.activeElement === element;
        const start = active ? element.selectionStart : 0;
        const end = active ? element.selectionEnd : 0;
        const direction = active ? element.selectionDirection : "none";
        element.value = value;
        if (active && typeof element.setSelectionRange === "function") {
          const limit = value.length;
          element.setSelectionRange(Math.min(start, limit), Math.min(end, limit), direction);
        }
      }
    } else if (!element.children.length) {
      const value = String(node.value || "");
      if (element.textContent !== value) element.textContent = value;
    }

    const canTab = !node.disabled && (node.canFocus || node.canPress || node.canSelect ||
      node.canSetValue || node.canSetTextSelection || node.canReplaceSelectedText ||
      node.canIncrement || node.canDecrement || node.canExpand || node.canCollapse || node.canDismiss ||
      node.canScrollIntoView || node.canScrollForward || node.canScrollBackward);
    setAttribute(element, "tabindex", canTab ? "0" : null);
    element.__alicornActions = node;
    element.oncompositionstart = () => { element.__alicornComposing = true; };
    element.oncompositionend = () => { element.__alicornComposing = false; };
    if (element.localName === "div" && (node.canPress || node.canSelect || node.canExpand || node.canCollapse)) {
      if (!element.__alicornKeyboardActivation) {
        element.__alicornKeyboardActivation = true;
        element.addEventListener("keydown", event => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          element.click();
        });
      }
    }
  };

  const reorderChildren = (parent, desired) => {
    // Stable nodes are only moved when the semantic order actually changed.
    const current = Array.from(parent.children);
    if (current.length === desired.length && current.every((node, index) => node === desired[index])) return;
    for (let index = desired.length - 1; index >= 0; index--) {
      const before = index + 1 < desired.length ? desired[index + 1] : null;
      if (desired[index].parentNode !== parent || desired[index].nextElementSibling !== before) {
        parent.insertBefore(desired[index], before);
      }
    }
  };

  const repositionFocusMarker = tree => {
    const marker = tree.focusMarker;
    const node = tree.focusNode;
    const viewportWidth = Number(tree.viewportWidth);
    const viewportHeight = Number(tree.viewportHeight);
    if (!tree.showFocus || !node || !node.hasBounds ||
        !Number.isFinite(viewportWidth) || !Number.isFinite(viewportHeight) ||
        viewportWidth <= 0 || viewportHeight <= 0) {
      marker.style.display = "none";
      return;
    }
    const x = Number(node.boundsX);
    const y = Number(node.boundsY);
    const width = Number(node.boundsWidth);
    const height = Number(node.boundsHeight);
    if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
      marker.style.display = "none";
      return;
    }
    const canvasRect = tree.canvas.getBoundingClientRect();
    if (canvasRect.width <= 0 || canvasRect.height <= 0) {
      marker.style.display = "none";
      return;
    }
    const scaleX = canvasRect.width / viewportWidth;
    const scaleY = canvasRect.height / viewportHeight;
    const left = Math.max(canvasRect.left, canvasRect.left + x * scaleX);
    const top = Math.max(canvasRect.top, canvasRect.top + y * scaleY);
    const right = Math.min(canvasRect.right, canvasRect.left + (x + width) * scaleX);
    const bottom = Math.min(canvasRect.bottom, canvasRect.top + (y + height) * scaleY);
    if (right <= left || bottom <= top) {
      marker.style.display = "none";
      return;
    }
    Object.assign(marker.style, {
      display: "block",
      left: `${left}px`,
      top: `${top}px`,
      width: `${right - left}px`,
      height: `${bottom - top}px`,
    });
  };

  window.alicornAccessibilityInit = (rootId, canvasId, textInputId = "") => {
    const root = document.getElementById(rootId);
    const canvas = document.getElementById(canvasId);
    if (!root || !canvas) throw new Error("Alicorn accessibility root or canvas element is missing");
    Object.assign(root.style, {
      position: "fixed", width: "1px", height: "1px", padding: "0", margin: "-1px",
      overflow: "hidden", clip: "rect(0, 0, 0, 0)", clipPath: "inset(50%)",
      whiteSpace: "nowrap", border: "0", left: "0", top: "0",
    });
    setAttribute(root, "role", "group");
    setAttribute(root, "aria-label", "Alicorn application controls");
    setAttribute(root, "tabindex", "-1");
    setAttribute(canvas, "aria-hidden", "true");
    setAttribute(canvas, "tabindex", "-1");
    if (textInputId) {
      const textInput = document.getElementById(textInputId);
      if (textInput) setAttribute(textInput, "aria-hidden", "true");
    }
    const focusMarker = document.createElement("div");
    setAttribute(focusMarker, "aria-hidden", "true");
    Object.assign(focusMarker.style, {
      position: "fixed", display: "none", boxSizing: "border-box", pointerEvents: "none",
      border: "2px solid Highlight", outline: "1px solid Canvas", outlineOffset: "1px",
      borderRadius: "2px", zIndex: "2147483647",
    });
    document.body.appendChild(focusMarker);
    const tree = {
      root, canvas, nodes: new Map(), revision: 0, hasRevision: false,
      focusMarker, focusNode: null, focusId: "", showFocus: false,
      viewportWidth: 0, viewportHeight: 0,
      repositionFocus: null, resizeObserver: null,
    };
    tree.repositionFocus = () => repositionFocusMarker(tree);
    window.addEventListener("resize", tree.repositionFocus);
    window.addEventListener("scroll", tree.repositionFocus, true);
    if (typeof window.ResizeObserver === "function") {
      tree.resizeObserver = new window.ResizeObserver(tree.repositionFocus);
      tree.resizeObserver.observe(canvas);
    }
    trees.set(rootId, tree);
  };

  window.alicornAccessibilityApply = payload => {
    const tree = trees.get(payload.root);
    if (!tree) throw new Error("Alicorn accessibility tree was not initialized");
    const focusId = payload.focus || "";
    const focusNode = payload.nodes.find(node => node.id === focusId) || null;
    const showFocus = !!payload.showFocus;
    const viewportWidth = Number(payload.viewportWidth) || 0;
    const viewportHeight = Number(payload.viewportHeight) || 0;
    if (tree.hasRevision && payload.revision === tree.revision &&
        focusId === tree.focusId && showFocus === tree.showFocus &&
        viewportWidth === tree.viewportWidth && viewportHeight === tree.viewportHeight) return;
    if (tree.hasRevision && payload.revision === tree.revision) {
      tree.focusId = focusId;
      tree.focusNode = focusNode;
      tree.showFocus = showFocus;
      tree.viewportWidth = viewportWidth;
      tree.viewportHeight = viewportHeight;
      repositionFocusMarker(tree);
      return;
    }
    const previousFocus = document.activeElement;
    const restoreFocus = tree.root.contains(previousFocus);
    const desiredIds = new Set(payload.nodes.map(node => node.id));
    for (const [id, element] of tree.nodes) {
      if (!desiredIds.has(id)) {
        if (element.parentNode) element.parentNode.removeChild(element);
        tree.nodes.delete(id);
      }
    }

    const byId = new Map();
    const children = new Map();
    for (const node of payload.nodes) {
      const element = ensureElement(tree, node);
      byId.set(node.id, element);
    }
    for (const node of payload.nodes) {
      const element = byId.get(node.id);
      patchElement(element, node);
      const parent = node.parent && byId.has(node.parent) ? byId.get(node.parent) : null;
      const parentElement = parent || tree.root;
      if (element.parentNode !== parentElement) parentElement.appendChild(element);
      let siblings = children.get(parentElement);
      if (!siblings) children.set(parentElement, siblings = []);
      siblings.push({ element, order: node.order });
    }
    for (const [parent, ordered] of children) {
      ordered.sort((a, b) => a.order - b.order);
      reorderChildren(parent, ordered.map(entry => entry.element));
    }

    const focused = payload.focus ? tree.nodes.get(payload.focus) : null;
    if (restoreFocus) {
      // A semantic node can disappear during virtualization or when a control
      // is removed. Keep browser focus inside the application instead of
      // letting removal silently drop it onto document.body.
      const focusTarget = focused || tree.root;
      if (document.activeElement !== focusTarget) {
        focusTarget.focus({ preventScroll: true });
      }
    }
    tree.revision = payload.revision;
    tree.hasRevision = true;
    tree.focusId = focusId;
    tree.focusNode = focusNode;
    tree.showFocus = showFocus;
    tree.viewportWidth = viewportWidth;
    tree.viewportHeight = viewportHeight;
    repositionFocusMarker(tree);
  };

  window.alicornAccessibilityDestroy = rootId => {
    const tree = trees.get(rootId);
    if (!tree) return;
    for (const element of tree.nodes.values()) element.remove();
    tree.nodes.clear();
    if (tree.resizeObserver) tree.resizeObserver.disconnect();
    window.removeEventListener("resize", tree.repositionFocus);
    window.removeEventListener("scroll", tree.repositionFocus, true);
    tree.focusMarker.remove();
    setAttribute(tree.canvas, "aria-hidden", null);
    setAttribute(tree.canvas, "tabindex", "0");
    tree.root.removeAttribute("role");
    tree.root.removeAttribute("aria-label");
    trees.delete(rootId);
  };
})();
