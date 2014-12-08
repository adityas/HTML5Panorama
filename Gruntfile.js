module.exports = function(grunt) {
	

	var config = {
		pkg : grunt.file.readJSON('package.json'),
		uglify : {
			options : {
				mangle : true, // p,a,c,k vars,
				unsafe : false
				
			},
			build : {
				src : 'src/HTML5Panorama.js',
				dest : 'dist/HTML5Panorama.min.js'
			}
		}

	};

	grunt.initConfig(config);
	grunt.loadNpmTasks('grunt-contrib-uglify');
	
	// Default task
	grunt.registerTask('default', [ 'uglify' ]);

};