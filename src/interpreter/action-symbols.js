var as;
var tinycl = require('../distribute/client.js');
var utils = require('../../lib/utils.js');
var types = require('../../resources/syntax-types.js');
var internalErrors = require('../diagnostics/context-errors.js');



(function (as) {

	if (!Array.prototype.interpreter) {
		Array.prototype.interpreter = function (env){
			var sem, items = this;
			for (var i = 0; i < items.length; i++) {
				if (items[i]) {
					sem =  items[i].interpreter(env);
					if (sem.continue_stmt || 
							sem.break_stmt || 
							sem.return_stmt) {
						break;
					}
				}
			}
			return ( sem ? sem : new Value(undefined) );
		};
	}

	function Value (value, property) {
		this.value = value;
		this[property] = true;
	}

	var opToExp = {
			'+': function (v1,v2) { return ( (v1!==undefined) ? v1 : 0) + v2; },
			'-': function (v1,v2) { return ( (v1!==undefined) ? v1 : 0) - v2; },
			'*': function (v1,v2) { return v1 * v2; },
			'/': function (v1,v2) { return parseInt(v1 / v2); },
			'%': function (v1,v2) { return v1 % v2; },
			'<': function (v1,v2) { return v1 < v2; },
			'<=': function (v1,v2) { return v1 <= v2; },
			'>': function (v1,v2) { return v1 > v2; },
			'>=': function (v1,v2) { return v1 >= v2; },
			'==': function (v1,v2) { return v1 === v2; },
			'!=': function (v1,v2) { return v1 !== v2; },
			'&&': function (v1,v2) { return v1 && v2; },
			'||': function (v1,v2) { return v1 || v2; }
	};
	
	function error(description) {
		throw new Error('\n   Internal Error: '+description);
	}

	function evalT (exp1, exp2, op, T) {
		var isInt = T===IntExp;
		var v1 = (isInt? parseInt(exp1.value): exp1.value),
		v2 = (isInt? parseInt(exp2.value): exp2.value);

		if (T===StringExp) {
			return new T(v1+v2);
		}
		
		return new T(opToExp[op](v1,v2));
	}

	function evalExp (exp1, exp2, expType, op) {

		switch (expType) {
		case AddExp: 
		case MulExp:
			if (utils.sameType(exp1,exp2,IntExp)) {
				return evalT(exp1,exp2,op,IntExp);
			}
			if (!utils.notSameType(exp1,exp2,StringExp)) {
				return evalT(exp1,exp2,op,StringExp);
			}
			break;
		case RelExp:
			if (utils.sameType(exp1,exp2,IntExp)) {
				return evalT(exp1,exp2,op,BoolExp);
			}
			break;
		case AndExp:
		case OrExp: 
			if (utils.sameType(exp1,exp2,BoolExp)) {
				return evalT(exp1,exp2,op,BoolExp);
			}
			break;
		case EqExp:
			return evalT(exp1,exp2,op,BoolExp);
		}

		error(internalErrors.typeError(op,exp1.value,exp2.value));
	}

	function evalUnitaryExp (exp, op) {
		switch (op) {
		case '+':
		case '-': 
			if (exp.hasType(IntExp)) {
				return evalT(new IntExp(0),exp,op,IntExp);
			}
			break;
		case '!':
			if (exp.hasType(BoolExp)) {
				return new BoolExp(!exp.value);
			}
			break;
		default: 
			error(internalErrors.typeError(op,exp.value));
		}
		
		error(internalErrors.typeError(op,exp.value));
	}

	/*
	 * ==================== Unitary expressions and related semantic routines ========================
	 */

	/**
	 *  UnitaryExp expression type
	 */
	function UnitaryExp(value, type, prefix){
		this.value = value;
		this.type = type;
		this.prefix = prefix;
	}

	UnitaryExp.prototype.interpreter = function (env) {
		if (this.prefix) {
			return evalUnitaryExp(this,this.prefix);
		}
		return this;
	};

	UnitaryExp.prototype.hasType = function (type) {
		return type === this.type;
	};

	/**
	 * UnitaryExp semantic routine
	 */
	as.UnitaryExp = function (root, operator, exp) {
		root.entry = exp.entry;
		root.entry.prefix = operator.text;
	};

	function processLiteral (EntryExp) {
		return function (root, literal) {
			root.entry = new EntryExp(literal.value, EntryExp);
		};
	}

	function StringExp(value){ 
		UnitaryExp.call(this, value, StringExp); 
	}
	StringExp.prototype = new UnitaryExp();

	/**
	 * StringLiteral semantic routine
	 */
	as.StringLiteral = processLiteral(StringExp);

	function IntExp(value){
		UnitaryExp.call(this, value, IntExp);
	}
	IntExp.prototype = new UnitaryExp();

	/**
	 *  IntExp semantic routine
	 */
	as.IntLiteral = processLiteral(IntExp);

	function BoolExp(value){
		UnitaryExp.call(this, value, BoolExp);
	}
	BoolExp.prototype = new UnitaryExp();

	/**
	 * BoolLiteral semantic routine
	 */
	as.BoolLiteral = processLiteral(BoolExp);

	function UndExp(value){
		UnitaryExp.call(this, value, UndExp);
	}
	UndExp.prototype = new UnitaryExp();

	/**
	 *  UndfinedLiteral semantic routine
	 */
	as.UndefinedLiteral = processLiteral(UndExp);

	/*
	 * ==================== Expressions and related semantic routines ========================
	 */

	/**
	 *  Exp type for expression
	 */
	function Exp(firstExp, operator, secondExp, infixType) {
		this.firstExp = firstExp;
		this.secondExp = secondExp;
		this.operator = operator;
		this.infixType = infixType;
	}

	Exp.prototype.interpreter = function (env) {
		// LL1 ast semantics is right-associative,
		// the problem matters for operators like -
		// the problem is handled forwarding the -
		// sign.

		var op = this.operator, res, v1, v2,
		type = this.infixType;

		if (this.prefix === '-' && this instanceof AddExp) {
			//this.prefix === '-' would be true only 
			//if this is an instanceof AddExp

			// this.firstExp could be an UnitaryExp, an Identifier,
			// or in presence di brackets () an AddExp or a MulExp.

			//let's interpreter
			v1 = this.firstExp.interpreter(env);
			v1 = evalUnitaryExp(v1, this.prefix);

		} else {
			v1 = this.firstExp.interpreter(env);
		}

		if (op === '-') {
			if (this.secondExp instanceof AddExp) {
				this.secondExp.prefix = '-'; //forward -
				v2 = this.secondExp.interpreter(env);
				op = '+'; // change op
			} else {
				v2 = this.secondExp.interpreter(env);
			}
		} else {
			v2 = this.secondExp.interpreter(env);
		}

		return evalExp(v1,v2,type,op);	

	};

	function processExp (EntryExp) {
		return function (root, operator, exp) {
			root.entry = new EntryExp(root.entry, operator.text , exp.entry, EntryExp);
		};
	}

	function ComplexExp (exp) {
		this.exp = exp;
	}

	ComplexExp.prototype.interpreter = function (env) {
		return this.exp.interpreter(env);
	};

	as.ComplexExp = function (root, exp) {
		root.entry = new ComplexExp (exp.entry);
	};

	/**
	 * MulExp semantic routine
	 */
	function MulExp(firstExp, operator, secondExp, type) {
		Exp.call(this, firstExp, operator, secondExp, type);
	}
	MulExp.prototype = new Exp();

	as.MulExp = processExp (MulExp);

	/**
	 * AddExp semantic routine
	 */
	function AddExp(firstExp, operator, secondExp, type) {
		Exp.call(this, firstExp, operator, secondExp, type);
	}
	AddExp.prototype = new Exp();

	as.AddExp = processExp (AddExp);

	/**
	 * EqExp semantic routine
	 */
	function EqExp(firstExp, operator, secondExp, type) {
		Exp.call(this, firstExp, operator, secondExp, type);
	}

	EqExp.prototype = new Exp();

	as.EqExp = processExp (EqExp);

	/**
	 * RelExp semantic routine
	 */
	function RelExp(firstExp, operator, secondExp, type) {
		Exp.call(this, firstExp, operator, secondExp, type);
	}
	RelExp.prototype = new Exp();

	as.RelExp = processExp (RelExp);

	/**
	 * AndExp semantic routine
	 */
	function AndExp(firstExp, operator, secondExp, type) {
		Exp.call(this, firstExp, operator, secondExp, type);
	}
	AndExp.prototype = new Exp();

	as.AndExp = processExp (AndExp);

	/**
	 * OrExp semantic routine
	 */
	function OrExp(firstExp, operator, secondExp, type) {
		Exp.call(this, firstExp, operator, secondExp, type);
	}
	OrExp.prototype = new Exp();

	as.OrExp = processExp (OrExp);

	/*
	 * ==================== Identifier and related semantic routine ========================
	 */

	function Identifier (name, args, prefix, postfix) {
		this.name = name;
		this.args = args;
		this.prefix = prefix;
		this.postfix = postfix;
	}

	Identifier.prototype.interpreter = function (env) {
		var name = this.name,
		found = env.lookup(name);

		if (!found) {
			error(internalErrors.notDeclared(name));
		}

		if (!this.args) {
			if (found instanceof UnitaryExp) {
				return (this.prefix? evalUnitaryExp(found,this.prefix): found);
			} else if (found instanceof Closure) {
				return found;
			}
			error('bad arguments');
		}

		if (found instanceof Closure) {

			var e = found.env, 
			body = found.fun.body, 
			params = found.fun.params;

			e = new Env(e);	//push env
			for (var i=0; i< params.length; i++) {
				var value = (i < this.args.length? this.args[i] : 
					new UndExp(undefined, UndExp));
				//actual params evaluated in the environment at 'call-time'
				value = value.interpreter(env);
				e.put(params[i].name, value); 
			}

			body = body.interpreter(e);
			e = e.prev; //pop env
			
			if (body.continue_stmt) {
				error(internalErrors.notExpectedKeyword('continue'));
			}
			
			if (body.break_stmt) {
				error(internalErrors.notExpectedKeyword('break'));
			}

			if (body.return_stmt) {
				if (this.prefix && (body.value instanceof Closure)) {
					error("forbidden operator " + this.prefix + "on closures");
				} else if (this.prefix && (body.value instanceof UnitaryExp)) {
					body.value = evalUnitaryExp(body.value.interpreter(e), this.prefix);
				}
				return body.value;
			}
			return new UndExp(undefined, UndExp);
		}

		error("identifier internal error");
	};

	/**
	 * Identifier semantic routine
	 */
	as.Identifier = function (root, id) {
		root.entry = new Identifier(id.text);
	};

	/**
	 * IdentifierExp semantic routine
	 */
	as.IdentifierExp = function (root, id, appl) {
		if (appl.entry === undefined) {
			if (appl.text !== undefined) { //TODO postfix
				id.entry.postfix = appl.text;
			}
		} else {
			id.entry.args = appl.entry;
		}
		root.entry = id.entry;
	};

	/*
	 * ==================== Function and related semantic routine ========================
	 */

	function Closure(fun, env) {
		this.fun = fun;
		this.env = env;
	}

	function Fun(identifier, params, body) {
		this.identifier = identifier;
		this.params = params;
		this.body = body;
		this.type = Fun;
	}

	Fun.prototype.interpreter = function (env) {
		var name = this.identifier.name,
		closure = new Closure(this,env);
		env.put(name, closure);
		return closure;
	};

	/**
	 *  Function semantic routine
	 */
	as.Function = function (root,identifier, params, body) {
		root.entry = new Fun (identifier.entry, params.entry, body.entry);
	};

	/*
	 * ==================== Statements and related semantic routines ========================
	 */

	/**
	 *  Assignment statement
	 */
	function AssignmentStmt (identifier, operator, value) {
		this.identifier = identifier;
		this.operator = operator;
		this.value = value;
	}

	AssignmentStmt.prototype.interpreter = function (env) {
		var name = this.identifier.name,
		value = this.value,
		op = this.operator,
		found, exp;

		if (!(found = env.lookup(name))) {
			error(internalErrors.notDeclared(name));
		}


		if (op !== '=') {
			if (op.charAt(0) === '+' || op.charAt(0) === '-') {
				exp = new AddExp(found, op.charAt(0), value, AddExp);
			} else {
				exp = new MulExp(found, op.charAt(0), value, AddExp);
			}
		} else {
			exp = this.value;
		}

		value = exp.interpreter(env);
		env.update(name, value);

		return new UndExp(undefined,UndExp);
	};

	as.Assignment = function (root,identifier, operator, value) {
		root.entry = new AssignmentStmt (identifier.entry, operator.text, value.entry);
	};

	/**
	 *  Declaration statement
	 */
	function DeclarationStmt (identifier, value) {
		this.identifier = identifier;
		this.value = value;
	}

	DeclarationStmt.prototype.interpreter = function (env) {
		var name = this.identifier.name,
		value = this.value ? this.value.interpreter(env) : new UndExp(undefined,UndExp);

		if (!(value instanceof UnitaryExp || value instanceof Closure)) {
			error("value internal error");
		}

		// don't care if other declarations in the same scope were made...
		env.put(name, value);
		return new UndExp(undefined, UndExp);
	};

	as.Declaration = function (root,identifier, value) {
		root.entry = new DeclarationStmt (identifier.entry, value.entry);
	};

	/**
	 *  For-loop statement
	 */
	function ForStmt (init, cond, update, body) {
		this.init = init;
		this.cond = cond;
		this.update = update;
		this.body = body;
	}

	ForStmt.prototype.interpreter = function (env) {
		var sem;

		if (this.init) {
			this.init.interpreter(env);
		}

		while (this.cond.interpreter(env).value) {

			if (this.body) {
				sem = this.body.interpreter(env);
			}

			if (sem.break_stmt || sem.return_stmt) {
				sem.break_stmt = false;
				break;
			}

			if (this.update) {
				this.update.interpreter(env);
			} 
		}

		if (sem && sem.continue_stmt) sem.continue_stmt = false;
		return (sem? sem : new Value(undefined));
	};

	as.ForLoop = function (root, init, cond, update, body) {
		root.entry = new ForStmt(init.entry, cond.entry, update.entry, body.entry);
	};

	/**
	 *  While-loop statement
	 */
	function WhileStmt (cond, body) {
		this.cond = cond;
		this.body = body;
	}

	WhileStmt.prototype.interpreter = function (env) {
		var sem;

		while (this.cond.interpreter(env).value) {
			if (this.body) {
				sem = this.body.interpreter(env);
				if (sem.break_stmt || sem.return_stmt) {
					sem.break_stmt = false;
					break;
				}
			}
		}

		if (sem && sem.continue_stmt)sem.continue_stmt = false;
		return (sem? sem : new Value(undefined));
	};

	as.WhileLoop = function (root, cond, body) {
		root.entry = new WhileStmt (cond.entry, body.entry);
	};

	/**
	 *  Switch-Case statement
	 */
	function SwitchCaseStmt (cond, cases, defaultt) {
		this.cond = cond;
		this.cases = cases;
		this.defaultt = defaultt;
	}

	SwitchCaseStmt.prototype.interpreter = function (env) {
		var cond = this.cond.interpreter(env), result = false, stop;
		for (var i = 0; i < this.cases.length; i++) {
			var case_guard = this.cases[i].cond.interpreter(env);
			result = (!result)? cond.value === case_guard.value: result; 
			if ( result ) {
				if (this.cases[i].body) {
					stop = this.cases[i].body.interpreter(env);
					if (stop.break_stmt || stop.return_stmt) {
						stop.break_stmt = false;
						break;
					}
				}
			}
		}
		if (!result || i === this.cases.length) {
			stop = this.defaultt.interpreter(env);
		}
		return (stop? stop : new Value(undefined));
	};

	as.SwitchCase = function (root, cond, cases, defaultt) {
		root.entry = new SwitchCaseStmt (cond.entry, cases.entry, defaultt.entry);
	};

	as.Case = function (root, cond, body) {
		root.entry = {cond: cond.entry, body: body.entry};
	};

	as.Default = function (root, body) {
		root.entry = body.entry;
	};

	/**
	 *  return statement
	 */
	function ReturnStmt (exp) {
		this.exp = exp;
	}

	ReturnStmt.prototype.interpreter = function (env) {

		if (this.exp) {
			return new Value(this.exp.interpreter(env),'return_stmt');
		}

		return new Value(undefined,'return_stmt');
	};

	as.Return = function (root, exp) {
		root.entry = new ReturnStmt(exp.entry);
	};

	/**
	 *  Continue statement
	 */
	function ContinueStmt () {}

	ContinueStmt.prototype.interpreter = function (env) {
		return new Value(undefined,'continue_stmt');
	};

	as.Continue = function(root) {
		root.entry = new ContinueStmt();
	};

	/**
	 *  Break statement
	 */
	function BreakStmt () {}

	BreakStmt.prototype.interpreter = function (env) {
		return new Value(undefined,'break_stmt');
	};

	as.Break = function (root) {
		root.entry = new BreakStmt();
	};

	/**
	 *  Println statement
	 */
	function Println(exp){
		this.exp = exp;
	}

	Println.prototype.interpreter = function (env) {
		var exp = this.exp.interpreter(env);
		console.log(exp.value);
		return new UndExp(undefined);
	};

	as.Println = function (root, exp) {
		root.entry = new Println(exp.entry);
	};

	/**
	 *  If-then-else statement
	 */
	function IfThenElseStmt(cond, then_branch, else_branch) {
		this.cond = cond;
		this.then_branch = then_branch;
		this.else_branch = else_branch;
	}

	IfThenElseStmt.prototype.interpreter = function (env) {
		var cond, body;

		cond = this.cond.interpreter(env);
		if (cond.value) {
			if (this.then_branch) {
				body = this.then_branch.interpreter(env);
			}
		} else if (this.else_branch) {
			body = this.else_branch.interpreter(env);
		}

		return (body? body : new UndExp(undefined, UndExp));
	};

	as.IfThenElse = function (root, cond, then_branch, else_branch) {
		root.entry = new IfThenElseStmt (cond.entry, then_branch.entry, else_branch.entry);
	};


	/**
	 * Expression >> statement
	 */
	function Expression (exp) {
		this.exp = exp;
	}

	Expression.prototype.interpreter = function (env) {
		return this.exp.interpreter(env);
	};

	as.Expression = function (root, exp) {
		root.entry = new Expression(exp.entry);
	};


	/**
	 * Eval
	 */
	function Eval (exp) {
		this.exp = exp;
	}

	Eval.prototype.interpreter = function (env) {
		var code = this.exp.interpreter(env).value;
		if (typeof(code) !== 'string') {
			error("eval needs a string value");
		}
		return parse(scan(code)).interpreter(env);
	};

	as.Eval = function (root, exp) {
		root.entry = new Eval(exp.entry);
	};

	/**
	 * DEval
	 */
	function DEval (exp, addr) {
		this.exp = exp;
		this.addr = addr;
	}

	DEval.prototype.interpreter = function (env) {
		var code = this.exp.interpreter(env).value,
		addr = this.addr.interpreter(env).value,
		res = tinycl.postCode(addr, code);
		res = tinycl.parseRes(res);

		if (res.type === 'IntExp') {
			res = new IntExp(res.value);
		} else if (res.type === 'BoolExp') {
			res = new BoolExp(res.value === "true"? true: false);
		} else if (res.type === 'StringExp') {
			res = new StringExp(res.value);
		} else {
			res = new UndExp(undefined);
		}

		return res;
	};

	as.DEval = function (root, exp, addr) {
		root.entry = new DEval(exp.entry, addr.entry);
	};

	/*
	 * ==================== Program semantic routine ========================
	 */

	function Program (env, elements) {
		this.env = env;
		this.elements = elements;
	}

	Program.prototype.interpreter = function (env) {
		var res;
		if (this.elements) {
			var env0 = (env? env : this.env);
			for (var i=0; i<this.elements.length; i++) {
				if (this.elements[i]) {
					
					res = this.elements[i].interpreter(env0);
					
					if (res.continue_stmt) {
						error(internalErrors.notExpectedKeyword('continue'));
					}
					
					if (res.break_stmt) {
						error(internalErrors.notExpectedKeyword('break'));
					}
					
					if (res.return_stmt) {
						break;
					}
				}
			}
		}
		return res;
	};

	/**
	 * Program semantic routine
	 */
	as.Program = function (root, elements) {
		return new Program(new Env(null), elements.entry);
	};

	/*
	 * ==================== Utility semantic routines ========================
	 */

	/**
	 * AppendParams semantic routine
	 */
	as.AppendParams = function (root, exp, list) {
		if (root.entry instanceof Array) {
			list.entry = root.entry.concat([exp.entry]);
		} else {
			root.entry = root.entry !== undefined ? 
					[root.entry, exp.entry] : 
						[exp.entry];
					list.entry = root.entry;
		}
	};

	/**
	 * FormalParams semantic routine
	 */
	as.FormalParams = function (root,params) {
		if (params.entry === undefined) {
			params.entry = [];
		}else if (!(params.entry instanceof Array)) {
			params.entry = [params.entry];
		}
		root.entry = params.entry;
	};

	/**
	 * ActualParams semantic routine
	 */
	as.ActualParams = function (root,params) {

		if (params.entry === undefined) {
			params.entry = [];
		}else if (!(params.entry instanceof Array)) {
			params.entry = [params.entry];
		}
		root.entry = params.entry;
	};

	/**
	 * Copy semantic routine
	 */
	as.Copy = function (source, target) {
		target.text = source.text;
		target.value = source.value;
		target.type = source.type;
		target.entry = source.entry;
	};



	var SyntaxType = types.SyntaxType;

	var grammar = {
			START: '<program>',
			FUNCTION: '<function>',
			VAR: '<var-stmt>',
			ASSIGN: '<assign-stmt>',
			ID : '<identifier>',
			INT : '<int-literal>',
			BOOL : '<bool-literal>',
			STRING: '<string-literal>',
			EVAL: '<eval>',
			DVAL: '<dval>',
			NEWLINE: 'newline',
			EOF: 'EOF',
			NONE: '$'
	};

	as.tokenToGrammar = function (token, scanner) {
		switch (token) {
		case SyntaxType.Identifier:
			return grammar.ID;
		case SyntaxType.IntegerLiteral:
			return grammar.INT;
		case SyntaxType.BoolLiteral:
			return grammar.BOOL;
		case SyntaxType.StringLiteral:
			return grammar.STRING;
		case SyntaxType.NewLineToken:
			return grammar.NEWLINE;
		case SyntaxType.EOFToken:
			return grammar.EOF;
		default:
			return scanner.getTokenText();
		}
	};

	/*
	 * in order to implement lexical scope:
	 * 		- variables are always looked up in an environment table passed in by the caller/kept as a variable
	 * 		- when interpreted code calls a function, the environment is NOT passed to that function. 
	 * 		- when an interpreted function is called, the environment its body is evaluated in is the environment 
	 * 		  in which the function definition was made, and has nothing whatsoever to do with the caller. 
	 * 		  So if you have a local function, then it is a closure.
	 */

	function Env(e){
		this.table = {};
		this.prev = e;
	}

	Env.prototype.put = function(name, value) {
		this.table[name] = value;
	};

	Env.prototype.update = function (name, value) {
		for (var e = this; e !== null; e = e.prev) {
			var found = e.table[name];
			if ( found ) {
				e.table[name] = value;
				break;
			}
		}
	};

	Env.prototype.lookup = function(name) {
		for (var e = this; e !== null; e = e.prev) {
			var found = e.table[name];
			if ( found ) {
				return found;
			}
		}
		return undefined;
	};

	var parse;
	var scan;

	as.setParseFun = function (fun) {
		parse = fun;
	};

	as.setScanFun = function (fun) {
		scan = fun;
	};

})(as || (as = {}));

module.exports = as;