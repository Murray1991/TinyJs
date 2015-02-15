module.exports = {
		
		notExpectedKeyword: function(name) {
			return 'keyword not expected: ' + name;
		},
		
		typeError: function(op,e1,e2) {
			return op + ' not defined for ' + e1 + ' ' + (e2===undefined? e2 : '');
		},
		
		notDeclared: function(name) {
			return 'variable ' + name + ' is not declared';
		}
		
};