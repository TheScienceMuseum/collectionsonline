[![Build Status](https://travis-ci.org/TheScienceMuseum/collectionsonline.svg?branch=master)](https://travis-ci.org/TheScienceMuseum/collectionsonline) [![Dependency Status](https://david-dm.org/TheScienceMuseum/collectionsonline.svg)](https://david-dm.org/TheScienceMuseum/collectionsonline) [![Coverage Status](https://img.shields.io/codecov/c/github/TheScienceMuseum/collectionsonline.svg?maxAge=2592000)](https://codecov.io/gh/TheScienceMuseum/collectionsonline)

# Science Museum Group: Collections Online

## Getting started

1. Install [Node.js](https://nodejs.org/en/) 6.x
2. Install dependencies: `bower install && npm install`
3. Copy `.corc.template` to `.corc` in the project route
4. Add required config values to `.corc`
5. Start the server: `npm start`

Or use `npm run watch` to rebuild and restart the server as you edit things.

## Directory structure

```
.
├── bin         # Executable(s) for starting the server etc.
├── lib         # Shared modules
├── public      # Public resources exposed by the server
├── routes      # API routes
├── schemas     # Joi schemas for input validation
├── templates   # Handlebars templates - layouts, pages, partials and helpers
└── test        # Unit and integration tests
```

## Collections

### Index types

The following main 3 document types are available in the index:

* Agent
* Object
* Archive

Other document types:

* Location (museum location / gallery)
* Event (historical)
* Place (geographical)
* Term (thesaurus term)

### Display names

The name of the index types isn't always obvious to the public so on the site they are mapped as follows:

* People => Agent
* Objects => Object
* Documents => Archive
* Location => Facility

### Routes

To access the pages we currently have templates for, use:

* `/`
* `/search?q={query}`
* `/objects/{id}/{slug?}`
* `/people/{id}/{slug?}`
* `/documents/{id}/{slug?}`

The routes will not work without params, however any random string will lead you to the example pages.
