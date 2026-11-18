const { Interp } = require('./interp.js');
let fails = 0;
function run(src, max = 200000) {
  const it = new Interp(src); let n = 0;
  while (it.stepInto() && n++ < max) {}
  return it;
}
function check(name, src, expected) {
  let out;
  try { const it = run(src); out = it.error ? 'ERR ' + it.error.type + ': ' + it.error.msg : it.out.map(o => o.text).join('|'); }
  catch (e) { out = 'THROW ' + e.message; }
  const ok = out === expected;
  if (!ok) fails++;
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : `\n   got:      ${out}\n   expected: ${expected}`));
}
check('arith', 'print(7//2, -7//2, 7%3, -7%3, 2**10, 7/2)', '3 -4 1 2 1024 3.5');
check('strings', 'print("a"+"b", "x"*3, len("abc"), "abc"[1], "abcdef"[1:4], "abc"[::-1])', 'ab xxx 3 b bcd cba');
check('fstring', 'x=3\nprint(f"x={x} {x*2:>4} {3.14159:.2f} {{ok}}")', 'x=3    6 3.14 {ok}');
check('lists', 'a=[3,1,2]\na.append(5)\na.sort()\nprint(a, a[-1], a[1:3], len(a))', '[1, 2, 3, 5] 5 [2, 3] 4');
check('dict', 'd={"a":1}\nd["b"]=2\nprint(d, d.get("z",0), "a" in d, list(d.keys()))', "{'a': 1, 'b': 2} 0 True ['a', 'b']");
check('tuple/unpack', 'a,b=1,2\na,b=b,a\nprint(a,b,(1,2),(5,))', '2 1 (1, 2) (5,)');
check('loops', 's=0\nfor i in range(5):\n    if i==3:\n        continue\n    s+=i\nprint(s)\nj=0\nwhile True:\n    j+=1\n    if j>4: break\nprint(j)', '7|5');
check('func+recursion', 'def f(n):\n    if n<=1:\n        return 1\n    return n*f(n-1)\nprint(f(10))', '3628800');
check('class', 'class P:\n    def __init__(self,x):\n        self.x=x\n    def inc(self):\n        self.x+=1\n        return self\np=P(1)\np.inc().inc()\nprint(p.x)', '3');
check('inherit+super', 'class A:\n    def __init__(self,v):\n        self.v=v\nclass B(A):\n    def __init__(self,v,w):\n        super().__init__(v)\n        self.w=w\nb=B(1,2)\nprint(b.v,b.w)', '1 2');
check('listcomp', 'print([x*x for x in range(5) if x%2==0], {k:k+1 for k in range(2)})', '[0, 4, 16] {0: 1, 1: 2}');
check('lambda sort', 'print(sorted([(1,"b"),(2,"a")], key=lambda p:p[1]), max([3,9,2]))', "[(2, 'a'), (1, 'b')] 9");
check('try/except', 'try:\n    x=[1][5]\nexcept IndexError as e:\n    print("caught", e)\nprint("after")', 'caught list index out of range|after');
check('raise custom', 'class E(Exception):\n    pass\ntry:\n    raise E("boom")\nexcept Exception as e:\n    print(e)', 'boom');
check('uncaught', 'x=1/0', 'ERR ZeroDivisionError: division by zero');
check('NameError', 'print(y)', "ERR NameError: name 'y' is not defined");
check('None cmp', 'print(None is None, 1 is not None)', 'True True');
check('global', 'c=0\ndef f():\n    global c\n    c+=1\nf();f()\nprint(c)', '2');
check('default/kw', 'def f(a,b=2,c=3):\n    return a+b+c\nprint(f(1), f(1,c=10))', '6 13');
check('aug list alias', 'a=[1]\nb=a\na+=[2]\nprint(b)', '[1, 2]');
check('set/deque', 'q=deque([1])\nq.append(2)\nprint(q.popleft(), set([1,1,2]) , 2 in {1,2})', '1 {1, 2} True');
check('syntax err', 'if x\n  y=1', 'THROW انتظار «:» می‌رفت');
check('persian ident', 'عدد = 5\nprint(عدد)', '5');
check('deep recursion', 'def f(n):\n    if n==0:\n        return 0\n    return 1+f(n-1)\nprint(f(150))', '150');
check('recursion limit', 'def f(n):\n    return f(n+1)\nf(0)', 'ERR RecursionError: maximum recursion depth exceeded');
// stepping modes
const it = new Interp('def f():\n    x=1\n    y=2\nf()\nz=3\n');
const lines = []; while (it.stepInto()) lines.push(it.curLine);
console.log('lines', lines.join(','));
const it2 = new Interp('def f():\n    x=1\n    y=2\nf()\nz=3\n');
it2.step('into'); it2.step('into'); console.log('stack depth in f:', it2.frames.length);
it2.step('out'); console.log('after out line', it2.curLine, 'depth', it2.frames.length);
const it3 = new Interp('def f():\n    x=1\nf()\nz=3\n'); it3.step('into'); it3.step('into'); it3.step('over'); console.log('over ->', it3.curLine);
process.exit(fails ? 1 : 0);
