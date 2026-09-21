import { iconFor } from "../etc/Icons.js";

export default class ExplorerTree {
  constructor(container, { onSelect } = {}) {
    this.container = container;
    this.onSelect = onSelect || (() => {});
    this.selectedId = null;
    this.nodesById = new Map();
    this.rowById = new Map();
  }

  setData(data) {
    this.nodesById.clear();
    this.rowById.clear();
    this.container.innerHTML = "";
    const ul = document.createElement("ul");
    ul.className = "explorer-tree";
    for (const item of data) ul.appendChild(this._renderNode(item, 0, true));
    this.container.appendChild(ul);
  }

  _renderNode(item, depth, expandDefault) {
    this.nodesById.set(item.id, item);
    const li = document.createElement("li");
    li.className = "explorer-node";
    const row = document.createElement("div");
    row.className = "explorer-row";
    row.style.paddingLeft = 6 + depth * 14 + "px";
    row.dataset.id = String(item.id);

    const hasChildren = item.children && item.children.length > 0;
    const twirl = document.createElement("span");
    twirl.className = "explorer-twirl" + (hasChildren ? "" : " empty");
    const expanded = expandDefault && depth < 2;
    twirl.textContent = hasChildren ? (expanded ? "▾" : "▸") : "";
    row.appendChild(twirl);

    const icon = document.createElement("img");
    icon.className = "explorer-icon";
    icon.width = 16;
    icon.height = 16;
    icon.src = item.icon || iconFor(item.className || "Instance");
    icon.alt = "";
    row.appendChild(icon);

    const label = document.createElement("span");
    label.className = "explorer-label";
    label.textContent = item.text;
    row.appendChild(label);

    li.appendChild(row);
    this.rowById.set(item.id, row);

    const childList = document.createElement("ul");
    childList.className = "explorer-children";
    if (!expanded) childList.hidden = true;
    if (hasChildren) {
      for (const child of item.children) childList.appendChild(this._renderNode(child, depth + 1, depth < 1));
    }
    li.appendChild(childList);

    twirl.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!hasChildren) return;
      const open = childList.hidden;
      childList.hidden = !open;
      twirl.textContent = open ? "▾" : "▸";
    });

    row.addEventListener("click", (event) => {
      event.stopPropagation();
      this.select(item.id, true);
    });

    row.addEventListener("dblclick", () => {
      if (!hasChildren) return;
      const open = childList.hidden;
      childList.hidden = !open;
      twirl.textContent = open ? "▾" : "▸";
    });

    return li;
  }

  select(id, notify = false) {
    if (this.selectedId != null && this.rowById.get(this.selectedId)) {
      this.rowById.get(this.selectedId).classList.remove("selected");
    }
    this.selectedId = id;
    const row = this.rowById.get(id);
    if (row) {
      row.classList.add("selected");
      this._expandAncestors(row);
      row.scrollIntoView({ block: "nearest" });
    }
    if (notify) {
      const node = this.nodesById.get(id);
      if (node) this.onSelect(node);
    }
  }

  _expandAncestors(row) {
    let el = row.parentElement;
    while (el && el !== this.container) {
      if (el.classList && el.classList.contains("explorer-children") && el.hidden) {
        el.hidden = false;
        const parentRow = el.previousElementSibling;
        const twirl = parentRow && parentRow.querySelector(".explorer-twirl");
        if (twirl && !twirl.classList.contains("empty")) twirl.textContent = "▾";
      }
      el = el.parentElement;
    }
  }

  getSelected() {
    return this.nodesById.get(this.selectedId) || null;
  }
}
