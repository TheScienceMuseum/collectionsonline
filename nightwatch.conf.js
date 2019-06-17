const fs = require('fs');
const binpath = './node_modules/nightwatch/bin/';
const TRAVIS_JOB_NUMBER = process.env.TRAVIS_JOB_NUMBER;

module.exports = {
  src_folders: ['test/client'],
  output_folder: 'reports',
  custom_commands_path: '',
  custom_assertions_path: '',
  page_objects_path: '',
  globals_path: '',

  selenium: {
    start_process: true,
    server_path: binpath + 'selenium.jar',
    log_path: '',
    host: '127.0.0.1',
    port: 4444,
    cli_args: {
      'webdriver.chrome.driver': binpath + 'chromedriver'
    }
  },

  test_settings: {
    travis: {
      launch_url: 'http://' + process.env.SAUCE_USERNAME + ':' + process.env.SAUCE_ACCESS_KEY + '@ondemand.saucelabs.com:80/wd/hub',
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
        chromeOptions: {
          w3c: false,
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
      selenium_port: 4444,
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
        chromeOptions: {
          w3c: false,
          args: ['--disable-dev-shm-usage']
        },
        javascriptEnabled: true,
        acceptSslCerts: true
      }
    },

    chrome: {
      desiredCapabilities: {
        browserName: 'chrome',
        chromeOptions: {
          w3c: false,
          args: ['--disable-dev-shm-usage']
        },
        javascriptEnabled: true,
        acceptSslCerts: true
      }
    }
  }
};

fs.stat(binpath + 'selenium.jar', function (err, stat) {
  if (err || !stat || stat.size < 1) {
    require('selenium-download').ensure(binpath, function (error) {
      if (error) throw new Error(error);
      console.log('✔ Selenium & Chromedriver downloaded to:', binpath);
    });
  }
});
