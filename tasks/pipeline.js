
var cssFilesToInject = [
  'styles/**/foundation.min.css',
  'styles/**/normalize.css',
  'styles/**/fontello.css',
  'styles/**/home.css'
];

var jsFilesToInject = [
  'js/dependencies/**/*.js',
];

var jsDashboardToInject = [
  'js/dependencies/**/*.js',
  'js/**/*.js'
];

var jsMainToInject = [
  'js/dependencies/**/*.js',
];

var templateFilesToInject = [
  'templates/**/*.html'
];

module.exports.cssFilesToInject = cssFilesToInject.map(function(path) {
  return '.tmp/public/' + path;
});

module.exports.jsDashboardToInject = jsDashboardToInject.map(function(path){
  return '.tmp/public/' + path;
});

module.exports.jsMainToInject = jsMainToInject.map(function(path){
  return '.tmp/public/' + path;
});

module.exports.jsFilesToInject = jsFilesToInject.map(function(path) {
  return '.tmp/public/' + path;
});

module.exports.templateFilesToInject = templateFilesToInject.map(function(path) {
  return 'assets/' + path;
});
