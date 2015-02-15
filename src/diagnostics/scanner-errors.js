
module.exports = {
		invalidToken: function(tokenInfo) {
			return 'invalid token\n\t'+tokenInfo;
		},
		
		invalidNumber: function(tokenInfo) {
			return 'invalid number starting with 0\n\t'+tokenInfo;
		}
};