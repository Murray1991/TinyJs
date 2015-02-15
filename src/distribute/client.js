var fs = require('fs'),
request = require('sync-request'),
querystring = require('querystring');

module.exports = {
		postCode: function (url, code) {
			var res = request('POST', url, {
				body: code,
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					'Content-Length': code.length
				}
			}).getBody().toString();

			return res;
		},
		
		parseRes: function (str) {
			return querystring.parse(str);
		}
};