const chromedriver = require('chromedriver');
const TRAVIS_JOB_NUMBER = process.env.TRAVIS_JOB_NUMBER;
const SELENIUM_PORT = process.env.NW_ENV === 'travis' ? 4445 : 9515;

module.exports = {
  src_folders: ['test/client'],
  output_folder: 'reports',
  custom_commands_path: '',
  custom_assertions_path: '',
  page_objects_path: '',
  globals_path: '',

  webdriver: {
    start_process: true,
    server_path: chromedriver.path,
    port: SELENIUM_PORT
  },

  test_settings: {
    travis: {
      launch_url: 'ondemand.saucelabs.com:80',
      selenium_port: 80,
      selenium_host: 'ondemand.saucelabs.com',
      silent: true,
      username: process.env.SAUCE_USERNAME,
      access_key: process.env.SAUCE_ACCESS_KEY,
      screenshots: {
        enabled: false,
        path: ''
      },
      globals: {
        waitForConditionTimeout: 10000
      },
      desiredCapabilities: {
        browserName: 'chrome',
        'goog:chromeOptions': {
          args: ['--disable-dev-shm-usage']
        },
        javascriptEnabled: true,
        acceptSslCerts: true,
        build: `build-${TRAVIS_JOB_NUMBER}`,
        'tunnel-identifier': TRAVIS_JOB_NUMBER
      }
    },

    default: {
      launch_url: 'http://localhost',
      selenium_port: SELENIUM_PORT,
      selenium_host: 'localhost',
      silent: true,
      screenshots: {
        enabled: false,
        path: ''
      },
      globals: {
        waitForConditionTimeout: 10000
      },
      desiredCapabilities: {
        browserName: 'chrome',
        'goog:chromeOptions': {
          args: ['--disable-dev-shm-usage']
        },
        javascriptEnabled: true,
        acceptSslCerts: true
      }
    },

    chrome: {
      desiredCapabilities: {
        browserName: 'chrome',
        'goog:chromeOptions': {
          args: ['--disable-dev-shm-usage']
        },
        javascriptEnabled: true,
        acceptSslCerts: true
      }
    }
  }
};
