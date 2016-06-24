[![Build Status](https://travis-ci.org/TheScienceMuseum/collectionsonline.svg?branch=master)](https://travis-ci.org/TheScienceMuseum/collectionsonline) [![Dependency Status](https://david-dm.org/TheScienceMuseum/collectionsonline.svg)](https://david-dm.org/TheScienceMuseum/collectionsonline) [![Coverage Status](https://img.shields.io/codecov/c/github/TheScienceMuseum/collectionsonline.svg?maxAge=2592000)](https://codecov.io/gh/TheScienceMuseum/collectionsonline)

# Science Museum Group: Collections Online

## Getting started

1. Install [Node.js](https://nodejs.org/en/) 4.x
2. Install dependencies: `npm install`
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

## Deployment

We use Travis for CI and production deployment. The `.travis.yml` file in the root directory contains configuration for deployments.

### Setup CI

Follow these steps to setup a new CI environment:

* Create an elasticbeanstalk Node.js app in the **eu-west-1** region
    * Make a note of the application name and environment name (you'll need this later)
* Get the name of the S3 bucket it creates
    * It will look like **elasticbeanstalk-eu-west-1-431258931377**
* Create an IAM user **smg-collectionsonline-deploy-travis**
    * Save the access key and secret (you'll need this later)
* Create an IAM group **smg-collections-online-deploy**
* Add the following inline policy (named: **DeployPolicy**) to the group, substituting the resource values appropriately:

    ```json
    {
        "Statement": [
            {
                "Effect": "Allow",
                "Action": [
                    "elasticbeanstalk:Check*",
                    "elasticbeanstalk:Describe*",
                    "elasticbeanstalk:List*",
                    "elasticbeanstalk:RequestEnvironmentInfo",
                    "elasticbeanstalk:RetrieveEnvironmentInfo",
                    "ec2:Describe*",
                    "elasticloadbalancing:Describe*",
                    "autoscaling:Describe*",
                    "cloudwatch:Describe*",
                    "cloudwatch:List*",
                    "cloudwatch:Get*",
                    "s3:Get*",
                    "s3:List*",
                    "sns:Get*",
                    "sns:List*",
                    "cloudformation:Describe*",
                    "cloudformation:Get*",
                    "cloudformation:List*",
                    "cloudformation:Validate*",
                    "cloudformation:Estimate*",
                    "rds:Describe*",
                    "sqs:Get*",
                    "sqs:List*"
                ],
                "Resource": "*"
            },
            {
                "Effect": "Allow",
                "Action": "s3:*",
                "Resource": [
                    "arn:aws:s3:::elasticbeanstalk-eu-west-1-431258931377",
                    "arn:aws:s3:::elasticbeanstalk-eu-west-1-431258931377/*"
                ]
            },
            {
                "Effect": "Allow",
                "Action": "elasticbeanstalk:*",
                "Resource": "arn:aws:elasticbeanstalk:eu-west-1:431258931377:*"
            },
            {
                "Effect": "Allow",
                "Action": "elasticbeanstalk:UpdateEnvironment",
                "Resource": "arn:aws:elasticbeanstalk:eu-west-1:431258931377:environment/Default-Environment/My First Elastic Beanstalk Application"
            },
            {
                "Effect": "Allow",
                "Action": "cloudformation:*",
                "Resource": "arn:aws:cloudformation:eu-west-1:431258931377:*"
            },
            {
                "Effect": "Allow",
                "Action": [  
                    "autoscaling:SuspendProcesses",
                    "autoscaling:ResumeProcesses"
                ],
                "Resource": "*"
            },
            {
                "Effect": "Allow",
                "Action": "elasticloadbalancing:*",
                "Resource": "arn:aws:elasticloadbalancing:eu-west-1:431258931377:*"
            }
        ]
    }
    ```

* Create a `.travis.yml` in the project root and add the following:

    ```
    language: node_js

    node_js:
      - '4'
    ```

* Install the [Travis CLI](https://github.com/travis-ci/travis.rb) tool
* Run `travis setup elasticbeanstalk`

    ```sh
    $ travis setup elasticbeanstalk
    Access key ID: AKIAIYE5GN7RNPZSZELA
    Secret access key: ****************************************
    Elastic Beanstalk region: |us-east-1| eu-west-1
    Elastic Beanstalk application name: My First Elastic Beanstalk Application
    Elastic Beanstalk environment to update: Default-Environment
    Encrypt secret access key? |yes|
    Deploy only from TheScienceMuseum/collectionsonline? |yes|
    ```

* Add the following to the travis config:
    * Zip up the built site before deploy

    ````yaml
    before_deploy:
      - zip -q -x .git\* node_modules/\* -r collectionsonline *
    ````

    * Add the bucket name, zip file path and skip cleanup to the deploy section:

    ```yaml
    deploy:
      bucket_name: elasticbeanstalk-eu-west-1-431258931377
      zip_file: collectionsonline.zip
      skip_cleanup: true
    ```

* In AWS elasticbeanstalk navigate to "Software Configuration" for the app
    * Add `npm start` as the "Node command"
    * Add config as environment vars to the new apps:
        * `co_rootUrl`
        * `co_elasticsearch__host`
