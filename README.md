
# TinyJs
TinyJs is a subset of Javascript with a limited number of primitive types: booleans,
integers, strings and functions. Variables without value have undefined type.

Functions are first-class citiziens, they have lexical scoping and can be declared
inside other functions. Anonymous functions are not implemented in TinyJs. Functions
are declared using the keyword ```function ```.

The TinyJs programming language includes typical imperative statements as ```var``` for
variable declaration, ```for ```, ```while ```, ```switch-case ```, ```continue ```, ```break ``` and ```return ```. They
work as to other programming languages. Moreover includes built-in functions as
```eval ``` and ```distributed_eval ``` which evaluate the TinyJs code represented as a string.
More detailed spec of the two functions is in PA-feb-15.pdf file.

See Examples section for a slighter better vision and comprehension of the language.

## Usage
In order to use the TinyJs interpreter, ensure that you have Node.js installed in
your machine. Thus it's sufficient change to the TinyJs directory and execute
``` 
node tinyjs.js --file /path/of/the/file.tjs 
```

## Something about the implementation
The parser is a LL(1) table-driven one, the grammar of the language is described in
```./resources/grammar.txt``` according to the BNF form and using a simple syntax (one
row for production).

For each invokation of the interpreter the file ```grammar.txt``` is parsed and the parsing
table is generated (see ```./lib/grammar.js``` library for details, the library computes the
FIRST and FOLLOW sets in order to generate the parsing table). The file ```grammar.txt``` is
enriched by semantic annotations (semantic actions) corresponding to function calls directly 
invoked by the parser when they appear on the top of the parsing stack. The parser use two 
stack data structures, one for parsing purposes (the parsing stack) the other (the semantic 
stack) is needed in order to support the semantic procedures when invoked.

The semantic annotations have the form of "#something($$,$1,$2, ..,$N)", where something is
the name of the associated semantic procedure (invoked through a function call by the interpreter),
$$ is the entry 'left' of the semantic stack (see the pseudocode), $1 is the entry 'right' of the 
semantic stack, $2 t the entry 'right+1' and so on until $N, the entry 'right+N-1' of the semantic
stack. Follows a pseudocode description of the parser:

```
	input: a string w and a parsing table M for G
	tos <- 0
	// description of left, right, curr and top is in parser.js file
	left <- -1  //semantic stack entry for the left-hand symbol of the current production
	right <- -1 //entry for the first right-hand symbol of the prod
	curr <- 0 //entry for the current symbol of the prod (the one whose being expanding)
	top <- 0 //top of the stack for the semantic stack
	parseStack[tos++] <- StartSymbol 
	semStack[top++] <- StartSymbol
	token <- next_token() 
	repeat
			X <- Stack[tos]
			if X is a terminal or EOF
				if X = token then
					parseStack.pop X
					token <- next_token()
					curr++;
				else error()
			 // X is a non-terminal
			else if M[ X, token ] = X -> Y1 Y2 ... Yk
					parseStack.pop X
					// eop entry for the parseStack
					// tell to the parser when 
					//a production has been finished
					parseStack.push EOP(left,right,curr,top)
					parseStack.push Yk, Yk-1, ... , Y1
					semStack.push Y1,Y2, ... , Yk' (excluding the symbol actions)
					//update the indexes
					left <- curr, right <- top,
					curr <- right, top <- top+k' //k' is the number of the non-action symbols
				else error()
			// parser here knows that the production expansion has been finished
			else if X = EOP
				restore left, right, curr and top from EOP
				curr++;
			else if X is an Action Symbol
				get its args from semantic stack
				and call the semantic routine associated
			else 
				error();
	until (parseStack is empty)
```
Each semantic procedure modify the semantic stack, giving more informations to its entries
and generating the AST, which is interpreted with an a recursive-descent approach starting
from the node root and calling the interpreter method associated to each node.

## Examples
Test examples are present in the directories ```./test/tinyjs-tests/``` and ```./test/tinyjs-distr-test/```
that contain acceptable programs. In ```./test/tinyjs-wrong-tests/``` are present tests with errors.
In order to show a little bit of sugar, follows the ```./test/tinyjs-tests/07.tjs``` test:

``` javascript
function executor(fun, par) { 
	return fun(par);
}

function returnFive() {
	return 5;	
}

var b = returnFive;
println(executor(returnFive)); //5
println(executor(b)); //5

// function counter with extra formal parameters
function counter(init, pippo, topolino, minnie) {
	var count = init;
	function incr(value) {
		count += value;
		return count;
	}
	return incr;
};

var i = executor(counter,executor(b));
var j = executor(counter,executor(b));

for ( var k = j(0) ; j(0) < 10; k=j(1) ){
	>> eval(">> i(5);");
}

println(j(0)); //10
println(i(0)); //30
```
The first evident tradeoff with the choice of implementing an LL(1) parser is the one that
utilizes a different syntax (```>> expr;```) for the expressions that don't appear at the 
right of an assignment or that are not used as actual parameters in a function call. The
genesis of this tradeoff is due to the fact that I didn't want complicate too much the
grammar making left-factoring over the identifiers or complicating the scanner.

## Problems
- The LL(1) parser generates right-associative ASTs. This "problem" (not really a problem, it's 
just a different meaning) has been solved for addictive expressions (see the "minus forwarding"
in the implementation) but NOT for the moltiplicative ones. Unfortunately the programmer
MUST handle it by himself (of course if he would prefer a left-associative semantics for 
the moltiplicative expressions), putting brackets where needed.

- The server handling the ```distributed_eval ``` requests is a very simple server built 
over Node.js, thus it is single-threaded and blocking on CPU-intensive requests. In the worst
scenario it could be blocked forever on a single request: (e.g. ``` distributed_eval("while(true){};", url); ```)

- In the computation over the network the only exchanged datas are the primitive types ones,
e.g. no closures are passed.

- The server keeps in a parmanently way an environment for each IP address, clear source of insecurity.

## TODO list
- Messare errors more meaningful and precise.
- Make the server efficient and possibly non-blocking on CPU-intensive requests.
- Solve the "problem" of right-associativity for the moltiplicative expressions.
- Generate the parsing table once and save it in a file.

## Ambiente
Tested on Linux and made with [Nodeclipse](https://github.com/Nodeclipse/nodeclipse-1).
