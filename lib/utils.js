
exports.sameType = function (expr1, expr2, type) {
	return ( expr2.type === type && expr1.type === type);
};

exports.notSameType = function (exp1, exp2, type) {
	return (exp1.type !== type && exp2.type !== type);
};

exports.hasType = function (exp1, type) {
	return (exp1.type === type);
};
