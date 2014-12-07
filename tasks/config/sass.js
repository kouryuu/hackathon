/**
 * Compiles LESS files into CSS.
 *
 * ---------------------------------------------------------------
 *
 * Only the `assets/styles/importer.less` is compiled.
 * This allows you to control the ordering yourself, i.e. import your
 * dependencies, mixins, variables, resets, etc. before other stylesheets)
 *
 * For usage docs see:
 * 		https://github.com/gruntjs/grunt-contrib-less
 */
module.exports = function(grunt) {

	grunt.config.set('sass', {
		dev: {
			files: [{
				expand: true,
				cwd: 'assets/styles/',
				src: ['**/*.sass'],
				dest: '.tmp/public/styles/',
				ext: '.css'
			},{
				expand: true,
				cwd: 'assets/src/',
				src: ['**/*.sass'],
				dest: '.tmp/public/styles/',
				ext: '.css'
			}]
		}
	});

	grunt.loadNpmTasks('grunt-contrib-sass');
};
