
var language = require('./scanner.js'),
ll = require('../../lib/grammar.js'),
_as = require('./action-symbols.js'),
parserErrors = require('../diagnostics/parser-errors.js');

// TODO generate parseTable and prodTable
// only once time, before the interpretation
var parseTable = ll.getParseTable();
var prodTable = ll.getProdTable();

(function(language) {
	
	var grammar = {
			START: '<program>',
			NONE: '$'
	};
	
	if (!Array.prototype.last) {
		Array.prototype.last = function(){
			return this[this.length - 1];
		};
		Array.prototype.toString = function() {
			var string = "";
			for (var i=0; i<this.length; i++) {
				string += this[i];
				string += ((i < this.length-1)? ',' : '');
			}
			return string;
		};
	}

	function SemanticEntry (symbol, entry, text, value, type) {
		this.symbol = symbol;
		this.entry = entry;
//		this.text = text;
//		this.value = value;
//		this.type = type;
	}

	function error(description) {
			throw new Error('\n   Syntax Error: '+description);
	}

	function isEop(eop) {
		var words = 
			["left", "right", "current", "top"];
		for (var i in eop) {
			if (words.indexOf(i) < 0) { 
				return false;
			}
		}
		return true;
	}

	function isSymbolAction(symbol) {
		if (typeof symbol === "string" &&
				symbol.charAt(0) === '#') {
			return true;
		}
		return false;
	}

	function isTerminal(symbol) {
		return !prodTable[symbol] && 
		!isEop(symbol) && 
		!isSymbolAction(symbol);
	}

	function isNonTerminal(symbol) {
		return prodTable[symbol] && 
		!isEop(symbol) && 
		!isSymbolAction(symbol);
	}

	/** key function TODO export */
	function parse(scanner) {

		var AST; 
		
		// dirty, it handles circular dependencies
		_as.setParseFun(parse);
		_as.setScanFun(language.getScanner);

		function nextToken() {
			return (token = scanner.scan());
		}

		// look ahead never used
		function lookAhead() {
			return scanner.lookAhead(scanner.scan);
		}

		function isSymbolExpected(currentSymbol) {
			return currentSymbol === semanticStack[currentIndex].symbol;
		}
		
		function getErrorInfo (token) {
			var name = getTokenInfo(token);
			
			return name+'\n\tat line '+line;
		}

		function getTokenInfo (token) {
			var tokenName = ( scanner.getTokenValue() ?
					scanner.getTokenValue():
						scanner.getTokenText() );
			return tokenName;
		}

		// Call the semantic routine associated to the parameter symbol the parameter 
		//symbol contains all the possible informations in order to call the correct 
		// semantic routine. Each symbol has the following syntax:    
		//
		//                  '#Something($$,$1,$2)'.
		//                             
		// where   $$ designate the semantic stack entry at leftIndex
		//         $1 designate the semantic stack entry at rightIndex
		//         $2 designate the semantic stack entry at rightIndex+1
		//         and so on
		function callSemanticRoutine (symbol) {

			function getIndex(numArg) {
				return ((numArg === 0)? leftIndex : 
					parseInt(rightIndex) + parseInt(numArg) - 1);
			}

			var fname = symbol.substring( 1, symbol.lastIndexOf("(")), 
			args = symbol.match(/\$([$]|\d)+/g);

			for (var i = 0; args !== null && i < args.length; i++) {
				var pick = args[i].charAt(1);
				args[i] = (pick === '$')? 0 : pick;
				args[i] = semanticStack[getIndex(args[i])];
			}

			if (!_as[fname]) {
				error(parserErrors.routineNameNotDefined(fname));
			}

			return _as[fname].apply( _as, args );
		}

		var semanticStack = {},
		parseStack = [],
		currentSymbol,
		token,
		// indexes for semantic stack and needed for the semantic routines
		/* points to the entry that stores the semantic record
		 * for the symbol on the left-hand side of the current 
		 * production */
		leftIndex = -1,
		/* points to the entry for the first element on the 
		 * right-hand side of the current production */
		rightIndex = -1,
		/*points to the entry for the element on the right-hand
		 *side of the current production that is being expanded*/
		currentIndex = 0,
		/*first free entry at the top of the semantic stack */
		topIndex = 0;

		//TODO: build symbol table

		parseStack.push(grammar.START);
		semanticStack[topIndex++] = 
			new SemanticEntry(grammar.START);

		nextToken();
		var line = 0;
		while (parseStack.length !== 0) {

			var key = _as.tokenToGrammar(token, scanner);
			currentSymbol = parseStack[parseStack.length-1];

			//TODO is it really necessary?
			if ( 	!isEop(currentSymbol) &&  
					!isSymbolAction(currentSymbol) && 
					!isSymbolExpected(currentSymbol) ) {

				error(parserErrors.stackCorrupted);
			}

			if (isTerminal(currentSymbol)) { 
				var x = parseStack.pop();
				if (currentSymbol !== grammar.NONE) {
					//TODO 	store the position of token in the source file
					//		in the semantic entry
					semanticStack[currentIndex].value =
						scanner.getTokenValue();
					semanticStack[currentIndex].text =
						scanner.getTokenText();

					nextToken();
					line = scanner.getLineNumber();
					currentIndex++;
				} 
			} else if (isNonTerminal(currentSymbol)) {
				var production,
				length = 0;

				production = 
					parseTable[currentSymbol][key];

				parseStack.pop();
				parseStack.push({ 
					left: leftIndex, 
					right: rightIndex, 
					current: currentIndex, 
					top: topIndex 
				});

				if (production) {
					length = production.length;
					for (var i = length, j = 0; i > 0; i-- ) {
						parseStack.push(production[i-1]);
						//push non-action symbol in the semantic stack
						if (!isSymbolAction(production[length-i])) {
							semanticStack[topIndex + j++] =
								new SemanticEntry(production[length-i]);
						}
					}
					// to update topIndex
					length = j;
				} else if (key !== grammar.NONE) {
					error(parserErrors.notExpectedToken(getErrorInfo(token)));
				}  else if (key !== '') {
					error(parserErrors.notExpectedToken(getErrorInfo(token)));
				} else if (key === grammar.NONE && !parseTable[currentSymbol][grammar.NONE]){
					error(parserErrors.notExpectedToken(getErrorInfo(token)));
				}
				
				//TODO pay attention with errors
//				else if (!parseTable[currentSymbol][grammar.NONE]) {
//				console.log('no entry for ' + currentSymbol + ' for ' + grammar.NONE);
//				error(parserErrors.notExpectedToken(getTokenInfo(token)), onError);
//				} else if (key !== '') {
//				console.log("key is not ''");
//				error(parserErrors.notExpectedToken(getTokenInfo(token)), onError);
//				}

				leftIndex = currentIndex;
				rightIndex = topIndex;
				currentIndex = rightIndex;
				topIndex += length;
			} else if (isEop(currentSymbol)) {
				
				leftIndex = currentSymbol.left;
				rightIndex = currentSymbol.right;
				currentIndex = currentSymbol.current;
				topIndex = currentSymbol.top;

				currentIndex++;
				parseStack.pop();
				
			} else if (isSymbolAction(currentSymbol)) {
				parseStack.pop();
				AST = callSemanticRoutine(currentSymbol);
			} else {
				error(parserErrors.notExpectedToken(getTokenInfo(token)));
			}
		}

		return AST;
	}

	language.parse = parse;

})(language || (language = {}));

module.exports = language;