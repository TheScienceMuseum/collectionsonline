module.exports = {
  sortChildren (data) {
    data.forEach((el) => {
      if (el.parent) {
        if (this.findNestedObject(data, el.parent[0].admin.uid)) {
          this.findNestedObject(data, el.parent[0].admin.uid).children.push(el);
        }
      }
    });
    return this.arrangeChildren(data[0]);
  },

  findNestedObject (objects, id) {
    var found;
    for (var i = 0; i < objects.length; i++) {
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
      for (var i = 0; i < item.children.length; i++) {
        this.arrangeChildren(item.children[i]);
      }
      item.children = item.children.sort(sortByIdentifier);
    }
    return item;
  }
};

function sortByIdentifier (a, b) {
  var aIdentifier = a.identifier;
  var bIdentifier = b.identifier;

  if (aIdentifier < bIdentifier) {
    return -1;
  }
  if (aIdentifier > bIdentifier) {
    return 1;
  }

  return 0;
}
