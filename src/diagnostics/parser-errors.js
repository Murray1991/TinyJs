module.exports = {
		
		notExpectedToken: function(info) {
			return 'token not expected ' + info;
		},
		
		stackCorrupted: 'stack corrupted',
		
		routineNameNotDefined: function(name) {
			return 'semantic name ' + name + ' not defined';
		}
		
		
};