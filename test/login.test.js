// const testWithServer = require('./helpers/test-with-server');

// testWithServer('Request for login Page', {}, async (t, ctx) => {
//   t.plan(1);

//   const htmlRequest = {
//     method: 'GET',
//     url: '/login'
//   };

//   const res = await ctx.server.inject(htmlRequest);
//   t.equal(res.statusCode, 200, 'Status code was as expected');
//   t.end();
// }, true);

// testWithServer('Attempt to acces the home page without authorisation', {}, async (t, ctx) => {
//   t.plan(1);

//   const htmlRequest = {
//     method: 'GET',
//     url: '/'
//   };

//   const res = await ctx.server.inject(htmlRequest);
//   t.equal(res.statusCode, 401, 'Status code was 401 not authorized');
//   t.end();
// }, true);

// testWithServer('Attempt to acces the home page without authorisation, redirect to login page if text/html origin request', {}, async (t, ctx) => {
//   t.plan(2);

//   const htmlRequest = {
//     method: 'GET',
//     url: '/',
//     headers: { 'Accept': 'text/html' }
//   };

//   const res = await ctx.server.inject(htmlRequest);
//   t.equal(res.statusCode, 302, 'Redirect the request');
//   t.equal(res.headers.location, '/login', 'Redirect to login page');
//   t.end();
// }, true);
