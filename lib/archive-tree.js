module.exports = {
  sortChildren (data) {
    data.forEach((el, i, arr) => {
      if (el.parent) {
        this.findNestedObject(data, el.parent[0].admin.uid).children
          ? this.findNestedObject(data, el.parent[0].admin.uid).children.push(el)
          : this.findNestedObject(data, el.parent[0].admin.uid).children = [el];
      }
    });
    return data[0];
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
  }
};
