module.exports = function(grunt) {
  // Project configuration.
  grunt.initConfig({
    three_b: 'node_modules/three/build',
    three_e: 'node_modules/three/examples/js',
    pkg: grunt.file.readJSON('package.json'),
    uglify: {
      options: {
        banner: '/*! <%= pkg.name %> <%= pkg.version %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
      },
      build: {
        src: [
          '<%= three_b %>/three.min.js',
          'src/GLTFLoader_lights_patch.js',
          '<%= three_e %>/shaders/CopyShader.js',
          '<%= three_e %>/shaders/FXAAShader.js',
          '<%= three_e %>/postprocessing/EffectComposer.js',
          '<%= three_e %>/postprocessing/RenderPass.js',
          '<%= three_e %>/postprocessing/ShaderPass.js',
          '<%= three_e %>/postprocessing/OutlinePass.js',
          '<%= three_e %>/libs/stats.min.js',
          'src/<%= pkg.name %>.js'
        ],
        dest: 'build/<%= pkg.name %>.min.js'
      }
    },
    concat: {
      build: {
        options: {
          banner: '/*! <%= pkg.name %> <%= pkg.version %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
        },
        src: [
          '<%= three_b %>/three.min.js',
          'src/GLTFLoader_lights_patch.js',
          '<%= three_e %>/shaders/CopyShader.js',
          '<%= three_e %>/shaders/FXAAShader.js',
          '<%= three_e %>/postprocessing/EffectComposer.js',
          '<%= three_e %>/postprocessing/RenderPass.js',
          '<%= three_e %>/postprocessing/ShaderPass.js',
          '<%= three_e %>/postprocessing/OutlinePass.js',
          '<%= three_e %>/libs/stats.min.js',
          'src/<%= pkg.name %>.js'
        ],
        dest: 'build/<%= pkg.name %>.js'
      },
      example_gettext: {
        src: [
          'node_modules/gettext.js/dist/gettext.min.js'
        ],
        dest: 'example/js/gettext.min.js'
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-uglify-es');
  grunt.loadNpmTasks('grunt-contrib-concat');

  // Default task(s).
  grunt.registerTask('build', ['concat:build', 'uglify']);
  grunt.registerTask('dev', ['concat:build',
                             'concat:example_gettext']);
};
