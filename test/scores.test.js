const test = require('tape');
const level = require('../lib/level.js');
const scores = require('../lib/scores.js');
const stub = require('sinon').stub;
const Stream = require('stream');
const database = [
  {key: '0000000!smgc-objects-10928', value: '1'},
  {key: '0010000!smgc-people-465699', value: '99999'},
  {key: '0100000!smgc-documents-11004957', value: '999999'},
  {key: '1000000!smgc-objects-24237', value: '2000000'}
];

test('Request for Scores', (t, ctx) => {
  t.plan(3);
  var data = Array.from(database);

  var levelCRS = stub(level, 'createReadStream', function (streamOpts) {
    var stream = new Stream();
    stream.readable = true;

    var i = 0;
    process.nextTick(function () {
      while (i < data.length) {
        stream.emit('data', data[i++]);
      }
      stream.emit('end');
    });
    return stream;
  });

  scores.getCount(0, function (err, result) {
    t.notOk(err, 'does not return an error');
    t.equal(result.length, 4, 'returns the correct number of results');
    t.equal(result[0], 'smgc-objects-10928', 'returns id correctly');
    levelCRS.restore();
    t.end();
  });
});

test('Update Low Value', (t, ctx) => {
  t.plan(3);
  var data = Array.from(database);

  var levelGet = stub(level, 'get', function (key, cb) {
    cb(null, data.find(el => el.key === key).value);
  });

  var levelPut = stub(level, 'put', function (key, value, cb) {
    data.splice(data.findIndex(el => el.key === key), 1, {key: key, value: value});
    cb();
  });

  scores.update('smgc-objects-10928', function (err, result) {
    t.notOk(err, 'no error');
    t.equal(result, 'smgc-objects-10928 count updated', 'correct response received');
    t.equal(data[0].value, '2', 'value was updated succesfully');
    levelGet.restore();
    levelPut.restore();
    t.end();
  });
});

test('Update Value and Score', (t, ctx) => {
  t.plan(4);
  var data = Array.from(database);

  var levelGet = stub(level, 'get', function (key, cb) {
    var value;
    var err;
    var obj = data.find(el => el.key === key);
    if (obj) {
      value = obj.value;
    } else {
      err = 'Cannot find ' + key;
    }
    cb(err, value);
  });

  var levelPut = stub(level, 'put', function (key, value, cb) {
    data.push({key: key, value: value});
    data.sort((a, b) => a.key > b.key);
    cb();
  });

  var levelDel = stub(level, 'del', function (key, cb) {
    data.splice(data.findIndex(el => el.key === key), 1);
    cb();
  });

  scores.update('smgc-people-465699', function (err, result) {
    t.notOk(err, 'no error');
    t.equal(result, 'smgc-people-465699 count and group updated', 'correct response received');
    t.equal(data[2].value, '100000', 'value was updated succesfully');
    t.equal(data[2].key, '0100000!smgc-people-465699', 'key was updated succesfully');
    levelGet.restore();
    levelPut.restore();
    levelDel.restore();
    t.end();
  });
});

test('Update Value and Score', (t, ctx) => {
  t.plan(4);
  var data = Array.from(database);

  var levelGet = stub(level, 'get', function (key, cb) {
    var value;
    var err;
    var obj = data.find(el => el.key === key);
    if (obj) {
      value = obj.value;
    } else {
      err = 'Cannot find ' + key;
    }
    cb(err, value);
  });

  var levelPut = stub(level, 'put', function (key, value, cb) {
    data.push({key: key, value: value});
    data.sort((a, b) => a.key > b.key);
    cb();
  });

  var levelDel = stub(level, 'del', function (key, cb) {
    data.splice(data.findIndex(el => el.key === key), 1);
    cb();
  });

  scores.update('smgc-documents-11004957', function (err, result) {
    t.notOk(err, 'no error');
    t.equal(result, 'smgc-documents-11004957 count and group updated', 'correct response received');
    t.equal(data[2].value, '1000000', 'value was updated succesfully');
    t.equal(data[2].key, '1000000!smgc-documents-11004957', 'key was updated succesfully');
    levelGet.restore();
    levelPut.restore();
    levelDel.restore();
    t.end();
  });
});

test('Update Max Scores Value', (t, ctx) => {
  t.plan(4);
  var data = Array.from(database);

  var levelGet = stub(level, 'get', function (key, cb) {
    var value;
    var err;
    var obj = data.find(el => el.key === key);
    if (obj) {
      value = obj.value;
    } else {
      err = 'Cannot find ' + key;
    }
    cb(err, value);
  });

  var levelPut = stub(level, 'put', function (key, value, cb) {
    data.push({key: key, value: value});
    data.sort((a, b) => a.key > b.key);
    cb();
  });

  var levelDel = stub(level, 'del', function (key, cb) {
    data.splice(data.findIndex(el => el.key === key), 1);
    cb();
  });

  scores.update('smgc-objects-24237', function (err, result) {
    t.notOk(err, 'no error');
    t.equal(result, 'smgc-objects-24237 count updated', 'correct response received');
    t.equal(data[4].value, '2000001', 'value was updated succesfully');
    t.equal(data[4].key, '1000000!smgc-objects-24237', 'key was updated succesfully');
    levelGet.restore();
    levelPut.restore();
    levelDel.restore();
    t.end();
  });
});

test('Update Scores that do not exist', (t, ctx) => {
  t.plan(4);
  var data = Array.from(database);

  var levelGet = stub(level, 'get', function (key, cb) {
    var value;
    var err;
    var obj = data.find(el => el.key === key);
    if (obj) {
      value = obj.value;
    } else {
      err = 'Cannot find ' + key;
    }
    cb(err, value);
  });

  var levelPut = stub(level, 'put', function (key, value, cb) {
    data.push({key: key, value: value});
    data.sort((a, b) => a.key > b.key);
    cb();
  });

  var levelDel = stub(level, 'del', function (key, cb) {
    data.splice(data.findIndex(el => el.key === key), 1);
    cb();
  });

  scores.update('smgc-objects-11111', function (err, result) {
    t.notOk(err, 'no error');
    t.equal(result, 'smgc-objects-11111 added to db', 'correct response received');
    t.equal(data[1].value, '1', 'value was updated succesfully');
    t.equal(data[1].key, '0000000!smgc-objects-11111', 'key was updated succesfully');
    levelGet.restore();
    levelPut.restore();
    levelDel.restore();
    t.end();
  });
});

test('Request for Scores with error', (t, ctx) => {
  t.plan(1);

  var levelCRS = stub(level, 'createReadStream', function (streamOpts) {
    var stream = new Stream();
    stream.readable = true;

    process.nextTick(function () {
      stream.emit('error');
    });
    return stream;
  });

  scores.getCount(0, function (err, result) {
    t.notOk(err, 'does return an error');
    levelCRS.restore();
    t.end();
  });
});

test('Update Scores that do not exist with Put error', (t, ctx) => {
  t.plan(1);
  var data = Array.from(database);

  var levelGet = stub(level, 'get', function (key, cb) {
    var value;
    var err;
    var obj = data.find(el => el.key === key);
    if (obj) {
      value = obj.value;
    } else {
      err = 'Cannot find ' + key;
    }
    cb(err, value);
  });

  var levelPut = stub(level, 'put', function (key, value, cb) {
    cb('error');
  });

  scores.update('smgc-objects-11111', function (err, result) {
    t.ok(err, 'error received');
    levelGet.restore();
    levelPut.restore();
    t.end();
  });
});

test('Update Scores and Value with Put Error', (t, ctx) => {
  t.plan(1);

  var data = Array.from(database);

  var levelGet = stub(level, 'get', function (key, cb) {
    var value;
    var err;
    var obj = data.find(el => el.key === key);
    if (obj) {
      value = obj.value;
    } else {
      err = 'Cannot find ' + key;
    }
    cb(err, value);
  });

  var levelPut = stub(level, 'put', function (key, value, cb) {
    cb('error');
  });

  scores.update('smgc-documents-11004957', function (err, result) {
    t.ok(err, 'error received');
    levelGet.restore();
    levelPut.restore();
    t.end();
  });
});

test('Update Scores with Del Error', (t, ctx) => {
  t.plan(1);
  var data = Array.from(database);

  var levelGet = stub(level, 'get', function (key, cb) {
    var value;
    var err;
    var obj = data.find(el => el.key === key);
    if (obj) {
      value = obj.value;
    } else {
      err = 'Cannot find ' + key;
    }
    cb(err, value);
  });

  var levelPut = stub(level, 'put', function (key, value, cb) {
    data.push({key: key, value: value});
    data.sort((a, b) => a.key > b.key);
    cb();
  });

  var levelDel = stub(level, 'del', function (key, cb) {
    cb('error');
  });

  scores.update('smgc-people-465699', function (err, result) {
    t.ok(err, 'error received');
    levelGet.restore();
    levelPut.restore();
    levelDel.restore();
    t.end();
  });
});

test('Update Max Scores with Put Error', (t, ctx) => {
  t.plan(1);
  var data = Array.from(database);

  var levelGet = stub(level, 'get', function (key, cb) {
    var value;
    var err;
    var obj = data.find(el => el.key === key);
    if (obj) {
      value = obj.value;
    } else {
      err = 'Cannot find ' + key;
    }
    cb(err, value);
  });

  var levelPut = stub(level, 'put', function (key, value, cb) {
    cb('error');
  });

  scores.update('smgc-objects-24237', function (err, result) {
    t.ok(err, 'error received');
    levelGet.restore();
    levelPut.restore();
    level.close();
    t.end();
  });
});
