
// I took CharacterCodes codes from TypeScript project
var CharacterCodes = require('../../resources/CharactersCodes.js');

var scanner = require('../../resources/syntax-types.js');
var scanErrors = require('../diagnostics/scanner-errors.js');

(function(scanner) {

	var SyntaxType = scanner.SyntaxType;

	var stringToToken = {
			"break": SyntaxType.BreakKeyWord,
			"case": SyntaxType.CaseKeyWord,
			"continue": SyntaxType.ContinueKeyWord,
			"default": SyntaxType.DefaultKeyWord,
			"distributed_eval": SyntaxType.DistributedEvalKeyWord,
			"else": SyntaxType.ElseKeyWord,
			"eval": SyntaxType.EvalKeyWord,
			"false": SyntaxType.FalseKeyWord,
			"for": SyntaxType.ForKeyWord,
			"function": SyntaxType.FunKeyWord,
			"if": SyntaxType.IfKeyWord,
			"int": SyntaxType.IntKeyWord,
			"println": SyntaxType.PrintlnKeyWord,
			"return": SyntaxType.ReturnKeyWord,
			"string": SyntaxType.StringKeyWord,
			"switch": SyntaxType.SwitchKeyWord,
			"true": SyntaxType.TrueKeyWord,
			"undefined": SyntaxType.UndefinedKeyWord,
			"var": SyntaxType.VarKeyWord,
			"while": SyntaxType.WhileKeyWord
	};

	scanner.getScanner = function(text) {

		var pos,
		len,
		startPos,
		tokenPos,
		tokenValue,
		token,
		lineNumber,
		skipNewLine,
		precedingLineBreak;
		
		function getPosition(){
			return 'at line '+lineNumber;
		}

		function error(description) {
			throw new Error('\n   ScanError: '+description);
		}

		function isLineBreak(ch) {
			var lineBreak = 
				ch === CharacterCodes.lineFeed ||
				ch === CharacterCodes.carriageReturn ||
				ch === CharacterCodes.lineSeparator  ||
				ch === CharacterCodes.paragraphSeparator ||
				ch === CharacterCodes.nextLine;
			//if (lineBreak) lineNumber++;
			return lineBreak;
		}

		function isDigit(ch) {
			return ch >= CharacterCodes._0 && 
			ch <= CharacterCodes._9;
		}

		function isIdStart(ch) {
			return ch >= CharacterCodes.A && 
			ch <= CharacterCodes.Z || 
			ch >= CharacterCodes.a && 
			ch <= CharacterCodes.z;
		}

		function isIdPart(ch) {
			return ch >= CharacterCodes.A && 
			ch <= CharacterCodes.Z || 
			ch >= CharacterCodes.a && 
			ch <= CharacterCodes.z ||
			ch >= CharacterCodes._0 && 
			ch <= CharacterCodes._9 || 
			ch === CharacterCodes.$ || 
			ch === CharacterCodes._;
		}

		function isWhiteSpace(ch) {
			return ch === CharacterCodes.space ||
			ch === CharacterCodes.tab || 
			ch === CharacterCodes.verticalTab ||
			ch === CharacterCodes.formFeed ||
			ch === CharacterCodes.nonBreakingSpace ||
			ch === CharacterCodes.ogham || 
			ch >= CharacterCodes.enQuad && ch <= CharacterCodes.zeroWidthSpace ||
			ch === CharacterCodes.narrowNoBreakSpace || 
			ch === CharacterCodes.mathematicalSpace || 
			ch === CharacterCodes.ideographicSpace || 
			ch === CharacterCodes.byteOrderMark;
		}

		function getIdentifierToken() {
			// Reserved words are between 2
			//and 16 characters long
			var len = tokenValue.length;
			if (len >= 2 && len <= 16) {
				var ch = tokenValue.charCodeAt(0);
				if (tokenValue === "true")
                    return (tokenValue = true, token = SyntaxType.BoolLiteral);
                else if (tokenValue === "false" )
                    return (tokenValue = false, token = SyntaxType.BoolLiteral);
                else if (ch >= CharacterCodes.a && 
						ch <= CharacterCodes.z && 
						hasOwnProperty.call(stringToToken, tokenValue)) {
					return (token = stringToToken[tokenValue]);
				}
			}
			return (token = SyntaxType.Identifier);
		}

		function skipUseless() {
			while (true) {
				var peek = text.charCodeAt(pos);
				switch(peek) {

				case CharacterCodes.tab:
				case CharacterCodes.space:
					pos++;
					continue;

				case CharacterCodes.slash:
					if (text.charCodeAt(pos+1) === CharacterCodes.slash) {
						pos += 2;
						while (pos < text.length) {
							if (isLineBreak(text.charCodeAt(pos))) {
								break;
							}
							pos++;
						}
						continue;
					}
					break;

				default:
					if (peek > CharacterCodes.maxAsciiCharacter && 
							(isWhiteSpace(peek) || isLineBreak(peek))) {
						pos++;
						continue;
					}
				break;

				}
			}
		}

		function scanNumber() {
			var start, end;

			start = pos;
			while (isDigit(text.charCodeAt(pos))) {
				pos++;
			}

			end = pos;
			if (start < end-1 && text.charCodeAt(start) === CharacterCodes._0) {
				error(scanErrors.invalidNumber(getPosition()));
			}

			return text.substring(start, end);
		}

		function scanString() {
			var quote = text.charCodeAt(pos++);
			var string = "";
			var start = pos;

			while (true) {

				if (pos > len) {
					throw new Error("internal scanner error");
					//break;
				}

				var ch = text.charCodeAt(pos);
				if (ch === quote) {
					string += text.substring(start, pos++);
					break;
				}

				pos++;
			}
			return string;
		}

		function getIdToken() {

		}

		function scan() {   
			// return SyntaxType object
			// TODO use generators? node => 11.0
			
			startPos = pos;

			while (true) {
				tokenPos = pos;
				tokenValue = undefined;
				if (pos >= len) {
					return (token = SyntaxType.EOFToken);
				}

				var ch = text.charCodeAt(pos);
				switch (ch) {
				case CharacterCodes.lineFeed:
				case CharacterCodes.carriageReturn:
					lineNumber++;
					pos++;
					if (skipNewLine) {
						continue;
					}
					return skipNewLine=true, token = SyntaxType.NewLineToken;
				case CharacterCodes.tab:
				case CharacterCodes.space:
					pos++;
					continue;
				case CharacterCodes.exclamation:
					if (text.charCodeAt(pos+1) === CharacterCodes.equals) {
						return pos+=2, token = SyntaxType.ExclamationEqualsToken;
					}
					return pos++, token = SyntaxType.ExclamationToken;
				case CharacterCodes.doubleQuote:
				case CharacterCodes.singleQuote:
					tokenValue = scanString();
					return (token = SyntaxType.StringLiteral);

				case CharacterCodes.comma:
					return pos++, token = SyntaxType.CommaToken;
				
				case CharacterCodes.colon:
					return pos++, token = SyntaxType.ColonToken;

				case CharacterCodes.closeBrace:
					return /*skipNewLine = false,*/ pos++, token = SyntaxType.CloseBraceToken;
				case CharacterCodes.CloseBracket:
					return pos++, token = SyntaxType.CloseBracketToken;
				case CharacterCodes.closeParen:
					return pos++, token = SyntaxType.CloseParenToken;

				case CharacterCodes.openBrace:
					return pos++, token = SyntaxType.OpenBraceToken;
				case CharacterCodes.openBracket:
					return pos++, token = SyntaxType.OpenBracketToken;
				case CharacterCodes.openParen:
					return pos++, token = SyntaxType.OpenParenToken;

				case CharacterCodes.equals:
					if (text.charCodeAt(pos+1) === CharacterCodes.equals) {
						return pos+=2, token = SyntaxType.EqualsEqualsToken;
					}
					return pos++, token = SyntaxType.EqualsToken;
				case CharacterCodes.greaterThan:
					if (text.charCodeAt(pos+1) === CharacterCodes.equals) {
						return pos+=2, token = SyntaxType.GreaterEqualsToken;
					} else if (text.charCodeAt(pos+1) === CharacterCodes.greaterThan) {
						return pos+=2, token = SyntaxType.GreaterGreaterToken;
					}
					return pos++, token = SyntaxType.GreaterToken;
				case CharacterCodes.lessThan:
					if (text.charCodeAt(pos+1) === CharacterCodes.equals) {
						return pos+=2, token = SyntaxType.LessEqualsToken;
					}
					return pos++, token = SyntaxType.LessToken;
				case CharacterCodes.plus:
					if (text.charCodeAt(pos+1) === CharacterCodes.plus) {
						return pos+=2, token = SyntaxType.PlusPlusToken;
					}
					else if (text.charCodeAt(pos+1) === CharacterCodes.equals) {
						return pos+=2, token = SyntaxType.PlusEqualsToken;
					}

					return pos++, token = SyntaxType.PlusToken;


				case CharacterCodes.minus:
					if (text.charCodeAt(pos+1) === CharacterCodes.minus) {
						return pos+=2, token = SyntaxType.MinusMinusToken;
					} 
					else if (text.charCodeAt(pos+1) === CharacterCodes.equals) {
						return pos+=2, token = SyntaxType.MinusEqualsToken;
					}

					return pos++, token = SyntaxType.MinusToken;

				case CharacterCodes.asterisk:
					if (text.charCodeAt(pos+1) === CharacterCodes.equals) {
						return pos+=2, token = SyntaxType.AsteriskEqualsToken;
					}

					return pos++, token = SyntaxType.AsteriskToken;


				case CharacterCodes.slash:
					if (text.charCodeAt(pos+1) === CharacterCodes.equals) {
						return pos+=2, token = SyntaxType.SlashEqualsToken;
					}
					else if (text.charCodeAt(pos + 1) === CharacterCodes.slash) {
						pos += 2;
						while (pos < len) {
							if (isLineBreak(text.charCodeAt(pos))) {
								break;
							}
							pos++;
						}
						continue;
					}
					return pos++, token = SyntaxType.SlashToken;

				case CharacterCodes.semicolon:
					return pos++, token = SyntaxType.SemicolonToken;

				case CharacterCodes.ampersand:
					if (text.charCodeAt(pos+1) === CharacterCodes.ampersand) {
						return pos+=2, token = SyntaxType.AmpersandAmpersandToken;
					}
					error(scanErrors.invalidToken(getPosition()));
					return;

				case CharacterCodes.bar:
					if (text.charCodeAt(pos+1) === CharacterCodes.bar) {
						return pos+=2, token = SyntaxType.BarBarToken;
					}
					error(scanErrors.invalidToken(getPosition()));
					return;

				case CharacterCodes._0:
				case CharacterCodes._1:
				case CharacterCodes._2:
				case CharacterCodes._3:
				case CharacterCodes._4:
				case CharacterCodes._5:
				case CharacterCodes._6:
				case CharacterCodes._7:
				case CharacterCodes._8:
				case CharacterCodes._9:
					tokenValue = scanNumber();
					if (tokenValue.length > 1 && tokenValue.charAt(0) === '0') {
						error(scanErrors.invalidNumber(getPosition()));
					}
					tokenValue = parseInt(tokenValue);
					return (token = SyntaxType.IntegerLiteral);

				default:
					
					if (isIdStart(ch)) {
						pos++;
						while (pos < len && isIdPart(ch = text.charCodeAt(pos))) { pos++; }
						tokenValue = text.substring(tokenPos, pos);
						return (token = getIdentifierToken());
					} else if (isWhiteSpace(ch)) {
						pos++;
						continue;
					} else if (isLineBreak(ch)) {
						precedingLineBreak = true;
						pos++;
						continue;
					} else {
						error(scanErrors.invalidToken(getPosition()));
					}
				return pos++, token = SyntaxType.Unknown;

				}
			}
		}

		function lookAhead(callback) {
			//save
			var savePos = pos;
			var saveStartPos = startPos;
			var saveTokenPos = tokenPos;
			var saveToken = token;
			var saveTokenValue = tokenValue;
			var savePrecedingLineBreak = precedingLineBreak;

			var result = callback();

			//restore
			pos = savePos;
			startPos = saveStartPos;
			tokenPos = saveTokenPos;
			token = saveToken;
			tokenValue = saveTokenValue;
			precedingLineBreak = savePrecedingLineBreak;

			return result;
		}

		function tryScan(callback) {
			//TODO
		}

		function setText(newText) {
			text = newText || "";
			len = text.length;
			setTextPos(0);
		}

		function setTextPos(textPos) {
			pos = textPos;
			startPos = textPos;
			tokenPos = textPos;
			lineNumber = textPos+1;
			skipNewLine = true;
			token = SyntaxType.Unknown;
			precedingLineBreak = false;
		}

		setText(text);

		return {
			getStartPos: function() { 
				return startPos; 
			},
			getLineNumber: function() {
				return lineNumber; 
			},
			getTextPos: function() { 
				return pos; 
			},
			getTokenPos: function() { 
				return tokenPos; 
			},
			getToken: function() { 
				return token; 
			},
			getTokenValue: function() { 
				return tokenValue; 
			},
			getTokenText: function() { 
				return text.substring(tokenPos, pos );
			},
			isId: function() { 
				return token === SyntaxType.Identifier; 
			},
			isInt: function() { 
				return token === SyntaxType.IntegerLiteral;
			},
			isString: function() { 
				return token === SyntaxType.StringLiteral; 
			},
			isBool: function() { 
				return token === SyntaxType.BoolLiteral; 
			},
			isReserved: function() { 
				return SyntaxType.FirstReservedWord && token <= SyntaxType.LastReservedWord;
			},
			considerNewLine: function() { 
				skipNewLine = false; 
			},
			notConsiderNewLine: function() {
				skipNewLine = true;
			},
			scan: scan,
			tryScan: tryScan,
			lookAhead: lookAhead
		};
	};
})(scanner || (scanner = {}));

module.exports = scanner;