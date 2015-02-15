
# TinyJs
TinyJs e' un sottoinsieme di Javascript con un numero limitato di tipi primitivi: 
booleani, interi, stringhe e funzioni. Variabili senza valore hanno tipo undefined.

Le funzioni sono "first-class citiziens", hanno scoping lessicale e possono essere 
dichiarate all'interno di altre funzioni. Vengono dichiarate attraverso la
keyword "function".

Il linguaggio include statements come var, for, while, continue, break e
return, i quali funzionano in maniera analoga ad altri linguaggi di programmazione. Inoltre
include le funzioni "eval" e "distributed_eval", le quali valutano il codice TinyJs
rappresentato come una stringa. La specifica delle due funzioni si trova in PA-feb-15.pdf

Si consiglia la visione della sezione "Esempi" per una maggiore comprensione del
linguaggio.

## Uso
E' necessario avere installato Node.js sulla propria macchina.
Quindi e' sufficiente portarsi nella directory TinyJs ed eseguire
``` 
node tinyjs.js --file /path/of/the/file.tjs 
```

## Dettagli implementativi
Il parser e' table-driven LL(1), la grammatica del linguaggio e' descritta in
./resources/grammar.txt con una notazione piuttosto semplice (una riga per produzione).

Ad ogni invocazione dell'interprete di TinyJs viene parsato il file grammar.txt e generata
la parsing table usata dal parser (per dettagli vedere ./lib/grammar.js, piccola libreria che
ho implementato che calcola gli insiemi first e follow per generare la parsing table ). 
Il file grammar.txt contiene annotazioni semantiche (action symbols) corrispondenti a procedure 
semantiche e direttamente invocate dal parser LL(1) quando appaiono nel top del parsing stack. 
Il parser usa quindi due stack, uno per il parsing (parsing stack) e l'altro (semantic stack)
necessario per le procedure semantiche quando vengono invocate.

Le annotazioni semantiche nel file hanno la forma di " #something($$,$1,$2, ..,$N) ", in questo 
caso something e' il nome della procedura semantica associata, $$ indica la entry dello
stack semantico a left (vedi poi), $1, la entry dello stack semantico a right, $2 a right+1 e
cosi' via fino ad $N che indica la entry dello stack semantico a right+N-1.
Per esemplificare, segue l'algoritmo usato (in pseudocodice) del parser:

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
Ogni procedura semantica modifica lo stack semantico, dando maggiori informazioni alle sue
entry e genera l'abstract-syntax tree, il quale viene interpretato con un approccio
"recursive-descent" partendo dal nodo radice.

## Esempi
Esempi sono presenti nelle directory ./test/tinyjs-tests e ./test/tinyjs-distr-test che
contengono programmi accettabili. In ./test/tinyjs-wrong-tests ci sono test con errori, usati
per verificare la bonta' (per niente buona, a dire il vero) dei messaggi di errore nelle varie
fasi dell'interprete. Ne segue uno (./test/tinyjs-tests/07.tjs):

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
Come si puo' notare dall'esempio il primo compromesso con la scelta di implementare un
parser LL(1), e' quella di utilizzare una sintassi diversa ('>> expr;') per le espressioni 
che non sono a destra di un assegnamento o che non sono usate come parametri attuali
nella chiamata di una funzione. Questo compromesso nasce dal fatto che non volevo complicare
ulteriormente la grammatica del linguaggio facendo left-factoring sugli identificatori nelle
produzioni per l'assegnamento e per le espressioni

## Problemi
- Il parser LL(1) genera AST che sono right associative. Nonostante la precedenza fra gli
operatori sia soddisfatta ed io abbia (presumo correttamente) risolto il problema di associativita' 
per le espressioni addittive in cui sono presenti sottrazioni (facendo 'forwarding del -', vedere 
implementazione per dettagli), non e' stato risolto il problema per le espressioni moltiplicative.
Sfortunatamente il programmatore DEVE in caso di divisioni gestire l'associativita' con le parentesi.
- Il server che gestisce le richieste per la funzione "distributed_eval" e' un semplice server
costruito sopra Node.js, poiche' e' single-threaded puo' bloccare gli altri client su una 
richiesta CPU-intensive. Nello scenario peggiore si puo' bloccare per un tempo indefinitivamente
lungo (per esempio: ```distributed_eval("while(true){};",url)``` );
- Nella computazione su network, gli unici tipi di dato scambiati sono tipi primitivi.
- Il server mantiene in modo permanente un ambiente per ogni indirizzo IP, evidente fonte di
insicurezza.

## TODO list
- Messaggi di errore piu' significativi.
- Rendere il server piu' efficiente e non bloccante su richieste CPU-intensive.
- Risolvere il problema dell'associativita' per le espressioni moltiplicative.
- Invece di generare la parsing table per ogni invocazione dell'interprete, generarla una sola volta
e salvarla in un file json in ./resources.

## Ambiente
Testato su macchina linux e creato con [Nodeclipse](https://github.com/Nodeclipse/nodeclipse-1).
