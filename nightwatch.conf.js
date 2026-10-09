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
    port: SELENIUM_PORT,
    // Selenium Manager downloads (and caches) a chromedriver matching the
    // installed Chrome. Resolved here rather than left unset because
    // Nightwatch would otherwise fall back to require('chromedriver'), and
    // Selenium Manager by default prefers any chromedriver on PATH (npm adds
    // every ancestor node_modules/.bin) even when its version doesn't match.
    // A getter so `node nightwatch.conf.js` in postinstall doesn't download.
    get server_path () {
      const { binaryPaths } = require('selenium-webdriver/common/seleniumManager');
      return binaryPaths([
        '--browser', 'chrome',
        '--language-binding', 'javascript',
        '--output', 'json',
        '--skip-driver-in-path'
      ]).driverPath;
    }
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
      reuseDriverSession: true,
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
