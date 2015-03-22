//TODO rewrite it in a better way.

var fs = require('fs');
var _path = require('path');
var path = _path.resolve(__dirname, "../resources/grammar.txt");

var grammar;
(function(grammar) {

	function isSymbolAction (symbol) {
		return symbol.charAt(0) === '#';
	}
	
	function scanGrammarFile (text) {
		
		var len = text.length,
			token = {},
			result = {},
			currPos = 0,
			savePos = 0;
		
		function isWS() {
			var ch = text.charAt(currPos);
			return ch === ' ' || ch === '\n' || ch === '\t';
		}
		
		function nextToken(token) {
			
			while (true) {
				
				var ch = text.charAt(currPos);
				
				if (currPos >= len) {
					token.code = 'eof';
					return token;
					
				} else {
					
					switch (ch) {
					
						case '\t':
						case ' ':
							currPos++;
							break;
							
						case '\n':
							currPos++;
							token.value = '\n';
							return token.code = 'newLine', token;
							
						default:
							var startPos = currPos;
							while (!isWS()) {
								currPos++;
							}
							return 	token.code = 'word',
									token.value = text.substring(startPos, currPos),
									token;
					}
				}
			}
		}
		
		return {
			
			ignoreNewLine: false,
			
			lookAhead: function () {
				var res;
				
				savePos = currPos;
				res = nextToken(result);
				currPos = savePos;
				
				return res;
			},
			
			next: function () {
				return nextToken (token);
			}
		};
	}
	
	function parseGrammarFile (tokenizer) {
		
		var tok = tokenizer.next(),
			prodTable = {}, nonTerm, line,
			strErr = 'parseGrammarFile: internal error';
		
		line = [];
		while (tok.code !== 'eof') {
			
			var nextTok = tokenizer.lookAhead();
			if (nextTok.value === '::=') {
				
				if (tok.code !== 'word') {
					throw new Error(strErr);
				}
				
				//tok.value is a non-terminal
				if (line.length > 0) {
					prodTable[nonTerm].push(line);
					line = [];
				}
				
				nonTerm = tok.value;
				if (!prodTable[nonTerm]) {
					prodTable[nonTerm] = [];
				}
				
				tok = tokenizer.next(); // ::=
				line = [];
				
			} else if (tok.code === 'newLine'){
				if (line.length > 0) {
					prodTable[nonTerm].push(line);
					line = [];
				}
				
			} else if (tok.code === 'word') {
				if (isSymbolAction(tok.value) && !prodTable[tok.value] ) {
					prodTable[tok.value] = [['$']];
				}
				line.push(tok.value);
				
			} else {
				throw new Error(strErr + ': ' + tok.code + ' ' + tok.value);
			}
			
			tok = tokenizer.next(); // newline or word
		}
		
		return prodTable;
	}
	
	function buildProdTable (text) {
		return parseGrammarFile(scanGrammarFile(text));
	}

	function firstA(symbol0, prodTable) {

		var checked = {},
		firstSet = [],
		stack = [];

		stack.push(symbol0);

		while ( stack.length > 0 ) {

			var symbol = stack.pop();
			if (!checked[symbol]) {
				checked[symbol] = {}; // avoid possible loops
			}

			var productions = prodTable[symbol];
			for (var i = 0; i < productions.length; i++) {
				var production = productions[i];
				for (var j = 0; production.length; j++) {
					var rightSymbol = production[j];
					if (!checked[symbol][rightSymbol]){
						checked[symbol][rightSymbol] = true;
						//terminal
						if (!prodTable[rightSymbol] ) {
							if (firstSet.indexOf(rightSymbol) < 0) {
								firstSet.push(rightSymbol);
							}
							break;
							// non terminal
						} else {
							stack.push(rightSymbol);
							break;
						}
					} else {
						break;
					}
				}
			}
		}

		return firstSet; 
	}

	function firstB (firstTable, prodTable) {

		var change = true;
		while (change) {
			change = false;
			/* for each non terminal */
			for (var symbol in prodTable) {
				if (prodTable.hasOwnProperty(symbol)){

					var productions = prodTable[symbol];
					for (var i=0; i<productions.length; i++) {

						var production = productions[i];
						for (var j =0; j<production.length; j++) {

							var rightSymbol = production[j];
							var firstSet = firstTable[rightSymbol];

							if (!firstTable[rightSymbol]) {
								firstTable[rightSymbol] = [rightSymbol];
							}

							if (prodTable[rightSymbol]) {
								var k;
								if (firstSet.indexOf("$") > -1) {
									var index = parseInt(j)+1;
									firstSet = (index < production.length) ? firstTable[production[index]] : [];
									for (k=0; k<firstSet.length; k++) {
										if (firstTable[symbol].indexOf(firstSet[k]) < 0) {
											firstTable[symbol].push(firstSet[k]);
											change = true;
										}
									}
								} else {
									for (k=0; k<firstSet.length; k++) {
										if (firstTable[symbol].indexOf(firstSet[k]) < 0) {
											firstTable[symbol].push(firstSet[k]);
											change = true;
										}
									}
									break;
								}
								continue;	
							}		
							break;
						}
					}
				}
			}
		}
	}

	grammar.getProdTable = function () {
		return buildProdTable (fs.readFileSync(path).toString());
	};

	// TODO merge firstA and firstB in one function
	grammar.getFirstTable = function (prodTable) {
		var firstTable = {};
		for (var symbol in prodTable) {
			if (prodTable.hasOwnProperty(symbol)) {
				firstTable[symbol] = firstA(symbol, prodTable);
			}
		}
		firstB(firstTable, prodTable);
		return firstTable;
	};

	var prodTable = grammar.getProdTable();
	var firstTable = grammar.getFirstTable (prodTable);

	function getFirst(prod, index) {
		var firstSet = [];
		for ( ; index < prod.length; index++ ) {
			var nonTerm = prodTable[prod[index]],
			set = nonTerm ? firstTable[prod[index]] : [prod[index]],
					i = set.indexOf('$');
			for (var pos = 0; pos < set.length ; pos++) {
				if (firstSet.indexOf(set[pos]) < 0) {
					firstSet.push(set[pos]);
				}
			}
			if (i < 0) {
				i = firstSet.indexOf('$');
				if (i > -1 ) { firstSet.splice(i,1); }
				break;
			}
		}
		return firstSet;
	}

	grammar.getFollowTable = function() {

		//initialization
		var followTable = {};
		for (var prop in prodTable) {
			if (prodTable.hasOwnProperty(prop)){
				followTable[prop] = [];
			}
		}

		followTable["<program>"].push("EOF");

		var change;
		do {
			change = false;
			for (var nonTerminal in prodTable) {
				if (prodTable.hasOwnProperty(nonTerminal)) {
					var productions = prodTable[nonTerminal];
					for (var i=0; i<productions.length; i++) {

						var production = productions[i];
						for ( var j=0; j<production.length; j++ ) {

							var symbol = production[j];

							if (prodTable[symbol]) {    //if non-terminal

								var firstSet;
								if ( j < production.length-1) {
									var index = parseInt(j) + 1;
									firstSet = getFirst(production, index);
								} else {
									firstSet = [];
								}

								for (var k = 0; k<firstSet.length;k++) {
									if ( firstSet[k] !== '$' && followTable[symbol].indexOf(firstSet[k]) <0 ) {
										followTable[symbol].push(firstSet[k]);
										change = true;
									}
								}

								if (firstSet.indexOf("$") > -1 || j === production.length-1 ) {
									for (k=0;k<followTable[nonTerminal].length;k++) {
										var el = followTable[nonTerminal][k];
										if (followTable[symbol].indexOf(el) < 0) {
											followTable[symbol].push(el);
											change = true;
										}
									}
								}
							}
						}
					}
				}
			}
		} while (change);

		return followTable;

	};

	var followTable = grammar.getFollowTable();

	grammar.isLL1 = function() {

		for (var nonTerminal in prodTable) {
			if (prodTable.hasOwnProperty(nonTerminal)){
				var productions = prodTable[nonTerminal];

				for (var i=0; i<productions.length; i++) {
					var index;
					var prod1 = productions[i];
					var first1 = getFirst(prod1, 0);
					var prod2, first2;
					for (var j=0; j<productions.length; j++) {

						prod2 = productions[j];
						if (prod1 === prod2) { continue; } //BAD STYLE

						first2 = getFirst(prod2, 0);
						for (index = 0; index<first2.length; index++) {
							if (first2[index] !== '$' && first1.indexOf(first2[index]) >= 0) {   // first2[index] != '$' sara' corretto?
								console.log("The grammar is not LL1");
								return false;
							}
						}
					}

					if (first1.indexOf('$') > -1) {

						var empty = true;
						for (j=0; j<productions.length; j++) {

							prod2 = productions[j];
							first2 = getFirst(prod2, 0);

							if (prod1 === prod2) continue;

							for (index = 0; index < first2.length; index++) {
								var symbol = first2[index];
								if (followTable[nonTerminal].indexOf(symbol) > -1) {
									console.log("The grammar is not LL1");
									empty = false;
									return empty;
								}
							}
						}
					}
				}
			}
		}


		return true;
	};

	grammar.getParseTable = function () {

		var parseTable = {};

		for (var nonTerminal in prodTable) {

			if (prodTable.hasOwnProperty(nonTerminal)){

				var productions = prodTable[nonTerminal];

				if (!parseTable[nonTerminal]) {
					parseTable[nonTerminal] = {};
				}

				for (var i = 0; i < productions.length; i++) {
					var production = productions[i];
					var first = getFirst(production, 0);

					for (var j=0; j<first.length; j++) {

						if (parseTable[nonTerminal][first[j]]) {
							console.log("first case not LL1 grammar");
							console.log("old entry: (" + nonTerminal + " , " + first[j] + ") -> [" + parseTable[nonTerminal][first[j]] + "]");
							console.log("new entry: (" + nonTerminal + " , " + first[j] + ") -> [" + production + "]");
						}

						if (first[j] !== '$') {
							parseTable[nonTerminal][first[j]] = production;
						}
					}


					if (first.indexOf("$") > -1) {
						var follow = followTable[nonTerminal];
						for (j=0; j<follow.length;j++) {
							if (parseTable[nonTerminal][follow[j]]) {
								console.log("follow case not LL1 grammar");
								console.log("old entry: (" + nonTerminal + " , " + follow[j] + ") -> [" + parseTable[nonTerminal][follow[j]] + "]");
								console.log("new entry: (" + nonTerminal + " , " + follow[j] + ") -> [" + production + "]");
							}
							parseTable[nonTerminal][follow[j]] = production;
						}
						if (follow.indexOf('$') > -1) {
							parseTable[nonTerminal].$ = production;
						}
					}
				}
			}
		}
		return parseTable;
	};

	function printFirstFollow () {
		var followTable = grammar.getFollowTable();

		for (var nonTerminal in prodTable) {
			if (prodTable.hasOwnProperty(nonTerminal)){
				var productions = prodTable[nonTerminal];

				console.log("FIRST("+nonTerminal+") = {"+firstTable[nonTerminal]+"}");
				console.log("FOLLOW("+nonTerminal+") = {"+followTable[nonTerminal]+"}\n");
			}
		}
	}

})(grammar || (grammar = {}));

module.exports = grammar ;