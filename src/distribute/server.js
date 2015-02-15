var http = require('http');
var querystring = require('querystring');
var tinyjs = require('../interpreter/parser.js');
var _path = require('path');
var fs = require('fs');

var envTable = {};

function getClientAddress (req) {
	return ((req.headers['x-forwarded-for'] || '').split(',')[0] ||
			req.connection.remoteAddress);
}

var evaluateTinyJs = function(codestring, req) {
	var value;

	try {
		var client_addr = getClientAddress(req),
		program = tinyjs.parse(
				tinyjs.getScanner(codestring));

		if (!envTable[client_addr]) {
			envTable[client_addr] = program.env;
		}

		value = program.interpreter(envTable[client_addr]);
		
	} catch (e) {
		console.log("error in interpretation... ");
	}
	
	if (!value || !value.type) { //function
		value = {value: undefined, type: 'UndExp'};
	} else {
		value.type = value.type.name;
	}

	return value;
};

var onPostRequest = function(req,res,callback) {
	var body = '';
	req.on('data', function(data) {
		body += data;
		if (body.length > 1e6) {
			req.connection.destroy();
		}
	});
	req.on('end', function(){
		try {
			var value = evaluateTinyJs(body, req);
			callback(value);
		} catch (e) {
			req.connection.destroy();
		}
	});
};

http.createServer(function handler (req, res){
	if (req.method === 'POST') {
		onPostRequest(req, res, function(post){
			var result = querystring.stringify(post);
			res.writeHead(200, "OK", {'Content-Type': 'text/json'});
			res.end(result);
		});
	} else {
		console.log('GET request');
		res.writeHead(200, "OK", {'Content-Type': 'text/plain'});
		res.end();
	}
}).listen(1337, '127.0.0.1');

console.log('Server running at http://127.0.0.1:1337/');
