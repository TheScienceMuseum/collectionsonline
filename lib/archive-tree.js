module.exports = {
  sortChildren (data) {
    // Index every node (including any pre-nested children) by id so each
    // parent lookup is O(1) — the largest fonds has ~11.5k records, which
    // made the previous recursive scan per node prohibitively slow.
    const byId = new Map();
    const stack = data.slice();
    while (stack.length > 0) {
      const node = stack.pop();
      if (!byId.has(node.id)) byId.set(node.id, node);
      if (node.children) stack.push(...node.children);
    }

    data.forEach((el) => {
      if (el.parent) {
        const parent = byId.get(el.parent[0]['@admin'].uid);
        if (parent) {
          if (!parent.children) parent.children = [];
          parent.children.push(el);
        }
      }
    });
    return this.arrangeChildren(data[0]);
  },

  findNestedObject (objects, id) {
    let found;
    for (let i = 0; i < objects.length; i++) {
      if (objects[i].id === id) {
        found = objects[i];
        break;
      } else if (objects[i].children) {
        found = this.findNestedObject(objects[i].children, id);
        if (found) {
          break;
        }
      }
    }
    if (found) {
      if (!found.children) found.children = [];
      return found;
    }
  },

  arrangeChildren (item) {
    if (item.children) {
      for (let i = 0; i < item.children.length; i++) {
        this.arrangeChildren(item.children[i]);
      }
      item.children = item.children.sort(sortByIdentifier);
    }
    return item;
  }
};

function sortByIdentifier (a, b) {
  const aIdentifier = a.identifier;
  const bIdentifier = b.identifier;

  if (aIdentifier < bIdentifier) {
    return -1;
  }
  if (aIdentifier > bIdentifier) {
    return 1;
  }

  return 0;
}
