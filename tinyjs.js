
var language = require('./src/interpreter/parser.js'),
argv = require('minimist')(process.argv.slice(2)),
_path = require('path'), fs = require('fs'), tinyjs;

if (argv.help) {
	console.log("examples: ");
	console.log("node tinyjs.js --file where/in/file.tjs");
	console.log("node tinyjs.js --dir where/in/");

	return;
}

if (!argv.file && !argv.dir) {
	console.log("wrong args: ");
	console.log("node tinyjs.js --help");
	return;
}

function interpretate (opts) {
	var program, buffer;
	
	if (opts.source) {
		buffer = fs.readFileSync(opts.source).toString();	
	} else {
		buffer = opts.text;
	}

	program = language.parse(language.getScanner(buffer));
	return program.interpreter();
}

if (argv.file) {
	var path = _path.resolve(argv.file);
	return interpretate ({source: path});

} else if (argv.dir) {
	var path = _path.resolve(argv.dir);
	var tests = fs.readdirSync(path);
	
	console.log('start with ' + path.toString());
	for (var i = 0; i < tests.length; i++) {
		try {
			if (tests[i] !== '.' && tests[i] !== '..') {
				var file = _path.resolve(path,tests[i]);
				console.log('=============== starting ' + file + '=============== \n');
				interpretate({source: file});
				console.log('\n=============== '+ file + ' completed' + '=============== \n');
			}
		} catch (e) { 
			console.log(e.stack);
			console.log('-------' + tests[i] + ' failed' + '-------\n');
		}
	}
}
