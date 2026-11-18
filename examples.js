/* ==========================================================================
   مثال‌های آموزشی (شبه‌کد شبیه پایتون)
   ========================================================================== */
(function (root) {
'use strict';

const AVL_CORE = `class Node:
    def __init__(self, key):
        self.key = key
        self.left = None
        self.right = None
        self.height = 1

def height(n):
    if n is None:
        return 0
    return n.height

def update(n):
    # ارتفاع = ۱ + بیشینهٔ ارتفاع دو فرزند
    n.height = 1 + max(height(n.left), height(n.right))

def balance(n):
    # ضریب تعادل = ارتفاع چپ - ارتفاع راست
    if n is None:
        return 0
    return height(n.left) - height(n.right)

def rotate_right(y):
    note("چرخش راست حول", y.key)
    x = y.left
    t2 = x.right
    x.right = y
    y.left = t2
    update(y)
    update(x)
    return x

def rotate_left(x):
    note("چرخش چپ حول", x.key)
    y = x.right
    t2 = y.left
    y.left = x
    x.right = t2
    update(x)
    update(y)
    return y

def rebalance(node):
    b = balance(node)
    if b > 1:
        if balance(node.left) < 0:
            node.left = rotate_left(node.left)   # حالت LR
        return rotate_right(node)                # حالت LL
    if b < -1:
        if balance(node.right) > 0:
            node.right = rotate_right(node.right)  # حالت RL
        return rotate_left(node)                   # حالت RR
    return node

def insert(node, key):
    if node is None:
        return Node(key)
    if key < node.key:
        node.left = insert(node.left, key)
    elif key > node.key:
        node.right = insert(node.right, key)
    else:
        return node
    update(node)
    return rebalance(node)
`;

const AVL_DELETE_FN = `
def min_node(n):
    while n.left is not None:
        n = n.left
    return n

def delete(node, key):
    if node is None:
        return None
    if key < node.key:
        node.left = delete(node.left, key)
    elif key > node.key:
        node.right = delete(node.right, key)
    else:
        if node.left is None:
            return node.right
        if node.right is None:
            return node.left
        s = min_node(node.right)     # جانشین ترتیب میانی
        node.key = s.key
        node.right = delete(node.right, s.key)
    update(node)
    return rebalance(node)
`;

const EXAMPLES = [
/* ------------------------------ آرایه ------------------------------ */
{ id: 'avl-insert', group: 'درخت AVL', title: 'درج در درخت AVL (با چرخش‌ها)', featured: true,
  desc: 'کلیدها یکی‌یکی درج می‌شوند. هر بار که ضریب تعادل از ۱ بیشتر شود، چرخش مناسب (LL، RR، LR، RL) انجام می‌شود. با «گام» جلو بروید و تغییر اشاره‌گرها را روی درخت ببینید.',
  code: AVL_CORE + `
root = None
for k in [10, 20, 30, 40, 50, 25]:
    note("درج کلید", k)
    root = insert(root, k)
print("ارتفاع درخت:", height(root))
` },
{ id: 'avl-delete', group: 'درخت AVL', title: 'حذف از درخت AVL',
  desc: 'ابتدا چند کلید درج می‌شود، سپس حذف از برگ، گرهٔ تک‌فرزندی و گرهٔ دو‌فرزندی (با جانشین) و بازتعادل‌سازی را ببینید.',
  code: AVL_CORE + AVL_DELETE_FN + `
root = None
for k in [20, 10, 30, 5, 15, 25, 40, 3]:
    root = insert(root, k)

note("حذف برگ ۴۰")
root = delete(root, 40)
note("حذف ۳۰ (تک‌فرزند)")
root = delete(root, 30)
note("حذف ۲۰ (ریشه، دو فرزند)")
root = delete(root, 20)
` },
{ id: 'avl-rotations', group: 'درخت AVL', title: 'هر چهار حالت چرخش AVL',
  desc: 'برای هر یک از چهار حالت LL، RR، LR و RL درختی تازه ساخته می‌شود.',
  code: AVL_CORE + `
def build(keys):
    r = None
    for k in keys:
        r = insert(r, k)
    return r

note("حالت LL")
root = build([30, 20, 10])
note("حالت RR")
root = build([10, 20, 30])
note("حالت LR")
root = build([30, 10, 20])
note("حالت RL")
root = build([10, 30, 20])
` },

{ id: 'bst', group: 'درخت دودویی', title: 'درخت جستجوی دودویی: درج، جستجو، حذف',
  desc: 'درج بازگشتی، جستجو و حذف با سه حالت (برگ، تک‌فرزند، دو‌فرزند) در یک BST ساده (بدون تعادل).',
  code: `class Node:
    def __init__(self, key):
        self.key = key
        self.left = None
        self.right = None

def insert(node, key):
    if node is None:
        return Node(key)
    if key < node.key:
        node.left = insert(node.left, key)
    elif key > node.key:
        node.right = insert(node.right, key)
    return node

def search(node, key):
    while node is not None and node.key != key:
        if key < node.key:
            node = node.left
        else:
            node = node.right
    return node

def delete(node, key):
    if node is None:
        return None
    if key < node.key:
        node.left = delete(node.left, key)
    elif key > node.key:
        node.right = delete(node.right, key)
    else:
        if node.left is None:
            return node.right
        if node.right is None:
            return node.left
        s = node.right
        while s.left is not None:
            s = s.left
        node.key = s.key
        node.right = delete(node.right, s.key)
    return node

root = None
for k in [50, 30, 70, 20, 40, 60, 80, 35]:
    root = insert(root, k)

found = search(root, 40)
root = delete(root, 20)
root = delete(root, 30)
root = delete(root, 50)
` },
{ id: 'btree-traverse', group: 'درخت دودویی', title: 'پیمایش‌های درخت دودویی',
  desc: 'پیمایش پیش‌ترتیب، میان‌ترتیب، پس‌ترتیب (بازگشتی) و سطح‌به‌سطح (با صف). اشاره‌گر node را روی درخت دنبال کنید.',
  code: `class Node:
    def __init__(self, key, left=None, right=None):
        self.key = key
        self.left = left
        self.right = right

root = Node(1, Node(2, Node(4), Node(5)), Node(3, None, Node(6)))

def preorder(node):
    if node is None:
        return
    out.append(node.key)
    preorder(node.left)
    preorder(node.right)

def inorder(node):
    if node is None:
        return
    inorder(node.left)
    out.append(node.key)
    inorder(node.right)

def postorder(node):
    if node is None:
        return
    postorder(node.left)
    postorder(node.right)
    out.append(node.key)

out = []
preorder(root)
print("پیش‌ترتیب", out)
out = []
inorder(root)
print("میان‌ترتیب", out)
out = []
postorder(root)
print("پس‌ترتیب", out)

# سطح‌به‌سطح
out = []
queue = [root]
while len(queue) > 0:
    node = queue.pop(0)
    out.append(node.key)
    if node.left is not None:
        queue.append(node.left)
    if node.right is not None:
        queue.append(node.right)
print("سطحی", out)
` },
{ id: 'general-tree', group: 'درخت عمومی', title: 'درخت عمومی و پیمایش DFS / BFS',
  desc: 'هر گره فهرستی از فرزندان دارد (children). پیمایش عمق‌اول بازگشتی و سطحی با صف.',
  code: `class TreeNode:
    def __init__(self, name):
        self.name = name
        self.children = []

    def add(self, child):
        self.children.append(child)
        return child

root = TreeNode("root")
a = root.add(TreeNode("A"))
b = root.add(TreeNode("B"))
c = root.add(TreeNode("C"))
a.add(TreeNode("A1"))
a.add(TreeNode("A2"))
b.add(TreeNode("B1"))
d = c.add(TreeNode("C1"))
d.add(TreeNode("C1a"))

order = []
def dfs(node):
    order.append(node.name)
    for ch in node.children:
        dfs(ch)

dfs(root)
print("DFS:", order)

order = []
queue = [root]
while len(queue) > 0:
    node = queue.pop(0)
    order.append(node.name)
    for ch in node.children:
        queue.append(ch)
print("BFS:", order)
` },

/* ------------------------------ لیست پیوندی ------------------------------ */
{ id: 'singly', group: 'لیست پیوندی', title: 'لیست پیوندی یک‌طرفه: درج، حذف، معکوس‌سازی',
  desc: 'کلاس LinkedList با head. اشاره‌گرهای cur ،prev و nxt هنگام معکوس‌سازی روی گره‌ها حرکت می‌کنند.',
  code: `class Node:
    def __init__(self, data):
        self.data = data
        self.next = None

class LinkedList:
    def __init__(self):
        self.head = None
        self.size = 0

    def push_front(self, x):
        n = Node(x)
        n.next = self.head
        self.head = n
        self.size += 1

    def push_back(self, x):
        n = Node(x)
        if self.head is None:
            self.head = n
        else:
            cur = self.head
            while cur.next is not None:
                cur = cur.next
            cur.next = n
        self.size += 1

    def remove(self, x):
        cur = self.head
        prev = None
        while cur is not None and cur.data != x:
            prev = cur
            cur = cur.next
        if cur is None:
            return False
        if prev is None:
            self.head = cur.next
        else:
            prev.next = cur.next
        self.size -= 1
        return True

    def reverse(self):
        prev = None
        cur = self.head
        while cur is not None:
            nxt = cur.next
            cur.next = prev
            prev = cur
            cur = nxt
        self.head = prev

lst = LinkedList()
lst.push_back(10)
lst.push_back(20)
lst.push_back(30)
lst.push_front(5)
lst.remove(20)
lst.reverse()
` },
{ id: 'doubly', group: 'لیست پیوندی', title: 'لیست پیوندی دوطرفه: درج و حذف',
  desc: 'هر گره prev و next دارد. حذف یک گره از وسط با اصلاح چهار اشاره‌گر.',
  code: `class Node:
    def __init__(self, data):
        self.data = data
        self.prev = None
        self.next = None

class DList:
    def __init__(self):
        self.head = None
        self.tail = None

    def push_back(self, x):
        n = Node(x)
        if self.tail is None:
            self.head = n
            self.tail = n
        else:
            n.prev = self.tail
            self.tail.next = n
            self.tail = n

    def push_front(self, x):
        n = Node(x)
        if self.head is None:
            self.head = n
            self.tail = n
        else:
            n.next = self.head
            self.head.prev = n
            self.head = n

    def insert_after(self, node, x):
        n = Node(x)
        n.prev = node
        n.next = node.next
        if node.next is not None:
            node.next.prev = n
        else:
            self.tail = n
        node.next = n

    def remove(self, node):
        if node.prev is not None:
            node.prev.next = node.next
        else:
            self.head = node.next
        if node.next is not None:
            node.next.prev = node.prev
        else:
            self.tail = node.prev

d = DList()
d.push_back(1)
d.push_back(2)
d.push_back(4)
d.push_front(0)
mid = d.head.next.next
d.insert_after(mid, 3)
d.remove(d.head.next)
d.remove(d.tail)
` },

/* ------------------------------ آرایه ------------------------------ */
{ id: 'array-insert', group: 'آرایه', title: 'درج و حذف در آرایه (جابه‌جایی عناصر)',
  desc: 'آرایه‌ای با ظرفیت ثابت: برای درج باید عناصر را به راست و برای حذف به چپ منتقل کرد.',
  code: `arr = [10, 20, 30, 40, 50, None, None, None]
n = 5                      # تعداد عناصر واقعی

# درج مقدار 25 در اندیس 2
pos = 2
i = n
while i > pos:
    arr[i] = arr[i - 1]    # انتقال به راست
    i -= 1
arr[pos] = 25
n += 1

# حذف عنصر اندیس 1
pos = 1
i = pos
while i < n - 1:
    arr[i] = arr[i + 1]    # انتقال به چپ
    i += 1
arr[n - 1] = None
n -= 1
` },
{ id: 'bubble', group: 'آرایه', title: 'مرتب‌سازی حبابی (نمای میله‌ای را روشن کنید)',
  desc: 'اندیس‌های i و j روی آرایه نمایش داده می‌شوند. از دکمهٔ «میله‌ای» در نوار ابزار برای دیدن ارتفاع مقدارها استفاده کنید.',
  code: `arr = [5, 2, 9, 1, 6, 3]
n = len(arr)
for i in range(n - 1):
    swapped = False
    for j in range(n - 1 - i):
        if arr[j] > arr[j + 1]:
            arr[j], arr[j + 1] = arr[j + 1], arr[j]
            swapped = True
    if not swapped:
        break
print(arr)
` },
{ id: 'binary-search', group: 'آرایه', title: 'جستجوی دودویی',
  desc: 'در هر گام نیمی از آرایه کنار گذاشته می‌شود؛ lo، mid و hi را دنبال کنید.',
  code: `arr = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91]
target = 23
lo = 0
hi = len(arr) - 1
found = -1
while lo <= hi:
    mid = (lo + hi) // 2
    if arr[mid] == target:
        found = mid
        break
    elif arr[mid] < target:
        lo = mid + 1
    else:
        hi = mid - 1
print("اندیس:", found)
` },
{ id: 'stack-queue', group: 'آرایه', title: 'پشته و صف (کلاس با آرایهٔ داخلی)',
  desc: 'شیء Stack و Queue هر کدام یک آرایهٔ items دارند؛ کارت «شیء» و کارت آرایه را کنار هم ببینید.',
  code: `class Stack:
    def __init__(self):
        self.items = []

    def push(self, x):
        self.items.append(x)

    def pop(self):
        return self.items.pop()

class Queue:
    def __init__(self):
        self.items = []

    def enqueue(self, x):
        self.items.append(x)

    def dequeue(self):
        return self.items.pop(0)

s = Stack()
s.push(1)
s.push(2)
s.push(3)
top = s.pop()

q = Queue()
q.enqueue("a")
q.enqueue("b")
q.enqueue("c")
first = q.dequeue()
` },

/* ------------------------------ گراف ------------------------------ */
{ id: 'bfs', group: 'گراف', title: 'پیمایش سطحی (BFS) روی لیست مجاورت',
  desc: 'گراف به‌صورت دیکشنری. رأس‌های دیده‌شده (visited) پرشده و رأس‌های درون صف رنگ دیگری دارند.',
  code: `graph = {
    'A': ['B', 'C'],
    'B': ['A', 'D', 'E'],
    'C': ['A', 'F'],
    'D': ['B'],
    'E': ['B', 'F'],
    'F': ['C', 'E'],
}
visited = set()
queue = ['A']
visited.add('A')
order = []
while len(queue) > 0:
    u = queue.pop(0)
    order.append(u)
    for v in graph[u]:
        if v not in visited:
            visited.add(v)
            queue.append(v)
print(order)
` },
{ id: 'dfs', group: 'گراف', title: 'پیمایش عمقی (DFS) بازگشتی',
  desc: 'پشتهٔ فراخوانی را در پنل «پشته» ببینید؛ هر فراخوانی بازگشتی یک رأس را باز می‌کند.',
  code: `graph = {
    1: [2, 3],
    2: [1, 4, 5],
    3: [1, 6],
    4: [2],
    5: [2, 6],
    6: [3, 5],
}
visited = set()
order = []

def dfs(u):
    visited.add(u)
    order.append(u)
    for v in graph[u]:
        if v not in visited:
            dfs(v)

dfs(1)
print(order)
` },
{ id: 'dijkstra', group: 'گراف', title: 'کوتاه‌ترین مسیر دایکسترا (گراف وزن‌دار)',
  desc: 'وزن یال‌ها روی گراف و فاصله‌ها (dist) زیر هر رأس نمایش داده می‌شود.',
  code: `graph = {
    'A': {'B': 4, 'C': 1},
    'B': {'D': 1},
    'C': {'B': 2, 'D': 5},
    'D': {},
}
dist = {'A': 0, 'B': inf, 'C': inf, 'D': inf}
done = set()

while len(done) < len(graph):
    u = None
    for x in graph:
        if x not in done and (u is None or dist[x] < dist[u]):
            u = x
    done.add(u)
    for v in graph[u]:
        if dist[u] + graph[u][v] < dist[v]:
            dist[v] = dist[u] + graph[u][v]
print(dist)
` },
{ id: 'matrix', group: 'گراف', title: 'ماتریس مجاورت',
  desc: 'گراف با ماتریس مجاورت: هم جدول و هم گراف رسم می‌شود. یال تازه اضافه کنید و اثر آن را ببینید.',
  code: `n = 4
adj = []
for i in range(n):
    adj.append([0] * n)

def add_edge(a, b):
    adj[a][b] = 1
    adj[b][a] = 1

add_edge(0, 1)
add_edge(0, 2)
add_edge(1, 3)
add_edge(2, 3)

degree = []
for i in range(n):
    d = 0
    for j in range(n):
        d += adj[i][j]
    degree.append(d)
print(degree)
` },
{ id: 'vertex-graph', group: 'گراف', title: 'گراف با شیءِ رأس (neighbors)',
  desc: 'هر رأس یک شیء با فهرست همسایه‌هاست؛ پیمایش DFS با ویژگی visited.',
  code: `class Vertex:
    def __init__(self, name):
        self.name = name
        self.neighbors = []
        self.visited = False

def connect(a, b):
    a.neighbors.append(b)
    b.neighbors.append(a)

A = Vertex('A')
B = Vertex('B')
C = Vertex('C')
D = Vertex('D')
E = Vertex('E')
connect(A, B)
connect(A, C)
connect(B, D)
connect(C, D)
connect(D, E)

def dfs(v):
    v.visited = True
    for w in v.neighbors:
        if not w.visited:
            dfs(w)

dfs(A)
` },

/* ------------------------------ تمرین خالی ------------------------------ */
{ id: 'blank', group: 'آزاد', title: 'صفحهٔ خالی (کد خودتان را بنویسید)',
  desc: 'کد خودتان را بنویسید. هر ساختاری که بسازید خودکار تشخیص داده و رسم می‌شود.',
  code: `# اینجا کد خود را بنویسید
class Node:
    def __init__(self, data):
        self.data = data
        self.next = None

a = Node(1)
b = Node(2)
a.next = b
` },
];

const api = { EXAMPLES };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.DSExamples = api;
})(typeof window !== 'undefined' ? window : globalThis);
