// Sample dataset for ConceptQuery.
// Course codes, papers and questions here are realistic placeholders written for
// development — replace with real digitised papers before this goes in front of students.

export const departments = [
  { code: 'CSE',  name: 'Computer Science',         fullName: 'Computer Science & Engineering',            status: 'active',  accentFrom: 'oklch(68% 0.19 296)', accentTo: 'oklch(66% 0.18 258)' },
  { code: 'ISE',  name: 'Information Science',      fullName: 'Information Science & Engineering',         status: 'active',  accentFrom: 'oklch(66% 0.18 258)', accentTo: 'oklch(78% 0.13 200)' },
  { code: 'ECE',  name: 'Electronics',              fullName: 'Electronics & Communication Engineering',   status: 'active',  accentFrom: 'oklch(78% 0.13 200)', accentTo: 'oklch(68% 0.19 296)' },
  { code: 'AIML', name: 'AI & Machine Learning',    fullName: 'Artificial Intelligence & Machine Learning', status: 'active',  accentFrom: 'oklch(68% 0.19 296)', accentTo: 'oklch(78% 0.13 200)' },
  { code: 'EEE',  name: 'Electrical',               fullName: 'Electrical & Electronics Engineering',      status: 'growing', accentFrom: 'oklch(70% 0.16 40)',  accentTo: 'oklch(75% 0.14 80)' },
  { code: 'ME',   name: 'Mechanical',               fullName: 'Mechanical Engineering',                    status: 'growing', accentFrom: 'oklch(72% 0.16 25)',  accentTo: 'oklch(70% 0.15 340)' },
  { code: 'CV',   name: 'Civil Engineering',        fullName: 'Civil Engineering',                         status: 'growing', accentFrom: 'oklch(74% 0.13 165)', accentTo: 'oklch(78% 0.13 200)' },
  { code: 'BT',   name: 'Biotechnology',            fullName: 'Biotechnology',                             status: 'planned', accentFrom: 'oklch(74% 0.13 165)', accentTo: 'oklch(76% 0.15 130)' },
  { code: 'MCA',  name: 'MCA',                      fullName: 'Master of Computer Applications',           status: 'planned', accentFrom: 'oklch(70% 0.15 340)', accentTo: 'oklch(68% 0.19 296)' },
];

export const courses = [
  { code: 'CS304', title: 'Data Structures and Applications',       dept: 'CSE',  semester: 3, credits: 4 },
  { code: 'CS303', title: 'Object Oriented Programming with Java',  dept: 'CSE',  semester: 3, credits: 3 },
  { code: 'CS402', title: 'Design and Analysis of Algorithms',      dept: 'CSE',  semester: 4, credits: 4 },
  { code: 'CS403', title: 'Database Management Systems',            dept: 'CSE',  semester: 4, credits: 4 },
  { code: 'CS501', title: 'Operating Systems',                      dept: 'CSE',  semester: 5, credits: 4 },
  { code: 'CS502', title: 'Computer Networks',                      dept: 'CSE',  semester: 5, credits: 3 },
  { code: 'CS601', title: 'Machine Learning',                       dept: 'CSE',  semester: 6, credits: 4 },
  { code: 'IS304', title: 'Data Structures',                        dept: 'ISE',  semester: 3, credits: 4 },
  { code: 'IS404', title: 'Software Engineering',                   dept: 'ISE',  semester: 4, credits: 3 },
  { code: 'IS505', title: 'Web Technologies',                       dept: 'ISE',  semester: 5, credits: 4 },
  { code: 'EC303', title: 'Digital Electronics',                    dept: 'ECE',  semester: 3, credits: 4 },
  { code: 'EC404', title: 'Signals and Systems',                    dept: 'ECE',  semester: 4, credits: 4 },
  { code: 'EC502', title: 'Microcontrollers and Embedded Systems',  dept: 'ECE',  semester: 5, credits: 3 },
  { code: 'AI401', title: 'Artificial Intelligence',                dept: 'AIML', semester: 4, credits: 4 },
  { code: 'AI502', title: 'Deep Learning',                          dept: 'AIML', semester: 5, credits: 4 },
  { code: 'EE303', title: 'Electrical Machines',                    dept: 'EEE',  semester: 3, credits: 4 },
  { code: 'EE402', title: 'Power Systems',                          dept: 'EEE',  semester: 4, credits: 3 },
  { code: 'ME303', title: 'Thermodynamics',                         dept: 'ME',   semester: 3, credits: 4 },
  { code: 'ME404', title: 'Fluid Mechanics',                        dept: 'ME',   semester: 4, credits: 3 },
  { code: 'CV303', title: 'Structural Analysis',                    dept: 'CV',   semester: 3, credits: 4 },
  { code: 'CV402', title: 'Geotechnical Engineering',               dept: 'CV',   semester: 4, credits: 3 },
];

// q: question number, m: marks, u: unit, t: topics, lv: cognitive level
const Q = (course, exam, year, month, num, text, marks, unit, topics, level = 'Understand') =>
  ({ course, exam, year, month, num, text, marks, unit, topics, level });

export const questions = [
  // ── CS304 Data Structures ────────────────────────────────────────────────
  Q('CS304', 'End Sem', 2024, 'Jan', '5a', 'Explain the algorithm for binary tree traversal (in-order, pre-order and post-order) with a suitable example.', 8, 3, ['binary tree', 'tree traversal', 'recursion'], 'Understand'),
  Q('CS304', 'End Sem', 2024, 'Jan', '5b', 'Construct a binary search tree for the sequence 45, 15, 79, 90, 10, 55, 12, 20, 50 and write the in-order traversal of the resulting tree.', 8, 3, ['binary search tree', 'binary tree', 'tree construction'], 'Apply'),
  Q('CS304', 'End Sem', 2024, 'Jan', '6a', 'Define AVL tree. Insert the elements 21, 26, 30, 9, 4, 14, 28 into an empty AVL tree showing rotations at each step.', 10, 4, ['AVL tree', 'binary tree', 'rotation', 'balancing'], 'Apply'),
  Q('CS304', 'End Sem', 2024, 'Jan', '6b', 'Write a C function to count the number of leaf nodes in a binary tree.', 6, 3, ['binary tree', 'leaf nodes', 'recursion'], 'Apply'),
  Q('CS304', 'End Sem', 2024, 'Jan', '3a', 'Explain the operations of a circular queue with the necessary algorithms for insertion and deletion.', 8, 2, ['queue', 'circular queue', 'data structure operations'], 'Understand'),
  Q('CS304', 'End Sem', 2024, 'Jan', '2b', 'Write an algorithm to convert an infix expression to postfix using a stack. Trace it for A+B*C-(D/E^F).', 10, 2, ['stack', 'infix to postfix', 'expression evaluation'], 'Apply'),
  Q('CS304', 'End Sem', 2024, 'Jan', '7a', 'Explain breadth first search and depth first search traversal of a graph with an example.', 8, 5, ['graph', 'BFS', 'DFS', 'graph traversal'], 'Understand'),
  Q('CS304', 'End Sem', 2024, 'Jan', '8b', 'What is hashing? Explain any two collision resolution techniques with examples.', 8, 5, ['hashing', 'collision resolution', 'hash table'], 'Understand'),

  Q('CS304', 'End Sem', 2023, 'Jan', '5a', 'Define a binary tree. Explain the array and linked list representation of a binary tree with examples.', 8, 3, ['binary tree', 'tree representation'], 'Understand'),
  Q('CS304', 'End Sem', 2023, 'Jan', '5b', 'Write recursive functions to perform pre-order and post-order traversal of a binary tree.', 8, 3, ['binary tree', 'tree traversal', 'recursion'], 'Apply'),
  Q('CS304', 'End Sem', 2023, 'Jan', '6a', 'Construct a binary search tree for the given sequence 50, 30, 70, 20, 40, 60, 80 and analyze its worst case height.', 10, 3, ['binary search tree', 'binary tree', 'complexity analysis'], 'Analyze'),
  Q('CS304', 'End Sem', 2023, 'Jan', '4a', 'Explain singly linked list and doubly linked list. Write a function to reverse a singly linked list.', 10, 2, ['linked list', 'singly linked list', 'doubly linked list'], 'Apply'),
  Q('CS304', 'End Sem', 2023, 'Jan', '7b', 'Define a graph. Explain adjacency matrix and adjacency list representation with an example.', 8, 5, ['graph', 'graph representation', 'adjacency matrix'], 'Understand'),
  Q('CS304', 'End Sem', 2023, 'Jan', '8a', 'Explain quick sort with an example. Derive its best case and worst case time complexity.', 10, 4, ['sorting', 'quick sort', 'complexity analysis'], 'Analyze'),

  Q('CS304', 'CIE II', 2023, 'Mar', '2a', 'Write an algorithm to search for a key in a binary search tree and state its time complexity.', 6, 3, ['binary search tree', 'binary tree', 'searching'], 'Apply'),
  Q('CS304', 'CIE II', 2023, 'Mar', '3b', 'Explain threaded binary trees and state their advantage over ordinary binary trees.', 6, 3, ['binary tree', 'threaded binary tree'], 'Understand'),

  Q('CS304', 'End Sem', 2022, 'Feb', '5a', 'Explain the properties of a binary tree. Prove that the maximum number of nodes at level i is 2^i.', 8, 3, ['binary tree', 'tree properties'], 'Analyze'),
  Q('CS304', 'End Sem', 2022, 'Feb', '5b', 'Write a program to find the height of a binary tree and count the total number of nodes.', 8, 3, ['binary tree', 'tree height', 'recursion'], 'Apply'),
  Q('CS304', 'End Sem', 2022, 'Feb', '6b', 'Explain heap sort with an example. What is the time complexity of building a heap?', 8, 4, ['heap', 'sorting', 'heap sort', 'complexity analysis'], 'Analyze'),
  Q('CS304', 'End Sem', 2022, 'Feb', '2a', 'Implement a stack using arrays. Write algorithms for push and pop operations with overflow and underflow checks.', 10, 2, ['stack', 'array', 'data structure operations'], 'Apply'),
  Q('CS304', 'End Sem', 2022, 'Feb', '7a', "Explain Prim's algorithm for finding a minimum cost spanning tree with an example.", 10, 5, ['graph', 'minimum spanning tree', 'Prims algorithm', 'greedy'], 'Apply'),

  Q('CS304', 'End Sem', 2021, 'Mar', '5a', 'Define binary tree. Explain complete binary tree and full binary tree with examples.', 6, 3, ['binary tree', 'tree types'], 'Remember'),
  Q('CS304', 'End Sem', 2021, 'Mar', '6a', 'Construct an expression tree for the postfix expression AB+CDE+**. Traverse it in in-order.', 8, 3, ['binary tree', 'expression tree', 'tree traversal'], 'Apply'),
  Q('CS304', 'End Sem', 2021, 'Mar', '3a', 'Explain the applications of stacks and queues in operating systems with examples.', 8, 2, ['stack', 'queue', 'applications'], 'Understand'),
  Q('CS304', 'End Sem', 2021, 'Mar', '8a', 'Compare linear search and binary search. Derive the time complexity of binary search.', 8, 4, ['searching', 'binary search', 'complexity analysis'], 'Analyze'),

  // ── CS402 Design and Analysis of Algorithms ──────────────────────────────
  Q('CS402', 'End Sem', 2024, 'Jun', '2a', 'Explain the divide and conquer strategy. Write the merge sort algorithm and derive its time complexity.', 10, 2, ['divide and conquer', 'merge sort', 'sorting', 'complexity analysis'], 'Analyze'),
  Q('CS402', 'End Sem', 2024, 'Jun', '3a', "Solve the 0/1 knapsack problem using dynamic programming for n=4, W=5, weights {2,3,4,5} and profits {3,4,5,6}.", 10, 3, ['dynamic programming', 'knapsack', 'optimization'], 'Apply'),
  Q('CS402', 'End Sem', 2024, 'Jun', '4a', "Explain Dijkstra's single source shortest path algorithm with an example. State its time complexity.", 10, 3, ['graph', 'shortest path', 'Dijkstra', 'greedy'], 'Apply'),
  Q('CS402', 'End Sem', 2024, 'Jun', '5b', 'What are NP-hard and NP-complete problems? Give examples of each.', 8, 5, ['NP-complete', 'NP-hard', 'complexity classes'], 'Understand'),
  Q('CS402', 'End Sem', 2024, 'Jun', '6a', 'Explain the backtracking method. Solve the 4-queens problem using backtracking and draw the state space tree.', 10, 4, ['backtracking', 'n-queens', 'state space tree'], 'Apply'),

  Q('CS402', 'End Sem', 2023, 'Jun', '2b', "Explain Huffman coding with an example. Construct the Huffman tree for characters with frequencies a:45, b:13, c:12, d:16, e:9, f:5.", 10, 3, ['greedy', 'Huffman coding', 'binary tree', 'compression'], 'Apply'),
  Q('CS402', 'End Sem', 2023, 'Jun', '3a', "Apply Floyd's algorithm to find the all-pairs shortest path for the given weighted graph.", 10, 3, ['graph', 'shortest path', 'Floyd algorithm', 'dynamic programming'], 'Apply'),
  Q('CS402', 'End Sem', 2023, 'Jun', '4b', 'Define asymptotic notations. Explain Big-O, Omega and Theta notation with examples.', 8, 1, ['asymptotic notation', 'complexity analysis'], 'Understand'),
  Q('CS402', 'End Sem', 2023, 'Jun', '6b', 'Explain the greedy method. Solve the job sequencing with deadlines problem for the given instance.', 10, 3, ['greedy', 'job sequencing', 'optimization'], 'Apply'),

  Q('CS402', 'CIE I', 2024, 'Mar', '1a', 'Derive the time complexity of the recurrence relation T(n) = 2T(n/2) + n using the master theorem.', 6, 1, ['recurrence relation', 'master theorem', 'complexity analysis'], 'Analyze'),
  Q('CS402', 'End Sem', 2022, 'Jul', '2a', 'Write the algorithm for binary search using divide and conquer. Analyze its best, average and worst case complexity.', 10, 2, ['divide and conquer', 'binary search', 'complexity analysis'], 'Analyze'),
  Q('CS402', 'End Sem', 2022, 'Jul', '5a', "Explain Kruskal's algorithm for minimum spanning tree with an example.", 8, 3, ['graph', 'minimum spanning tree', 'Kruskal', 'greedy'], 'Apply'),
  Q('CS402', 'End Sem', 2022, 'Jul', '7a', 'Explain the travelling salesman problem. Solve it using the branch and bound technique.', 10, 4, ['branch and bound', 'travelling salesman', 'optimization'], 'Apply'),

  // ── CS403 Database Management Systems ────────────────────────────────────
  Q('CS403', 'End Sem', 2024, 'Jun', '2a', 'Explain the three level architecture of a DBMS with a neat diagram. State the advantages of data independence.', 10, 1, ['DBMS architecture', 'data independence', 'three schema'], 'Understand'),
  Q('CS403', 'End Sem', 2024, 'Jun', '3a', 'Define functional dependency. Explain 1NF, 2NF and 3NF with suitable examples.', 10, 3, ['normalization', 'functional dependency', 'normal forms'], 'Understand'),
  Q('CS403', 'End Sem', 2024, 'Jun', '3b', 'Given R(A,B,C,D,E) with FDs A->BC, CD->E, B->D, E->A, find all candidate keys and normalize to BCNF.', 10, 3, ['normalization', 'BCNF', 'candidate key', 'functional dependency'], 'Analyze'),
  Q('CS403', 'End Sem', 2024, 'Jun', '4a', 'Explain ACID properties of a transaction with examples.', 8, 4, ['transaction', 'ACID', 'concurrency'], 'Understand'),
  Q('CS403', 'End Sem', 2024, 'Jun', '5a', 'Write SQL queries for the given schema: (i) list employees earning above average salary (ii) department-wise count of employees.', 10, 2, ['SQL', 'queries', 'aggregate functions'], 'Apply'),
  Q('CS403', 'End Sem', 2024, 'Jun', '6b', 'Explain two phase locking protocol. How does it ensure serializability?', 8, 4, ['transaction', 'concurrency control', 'two phase locking', 'serializability'], 'Understand'),

  Q('CS403', 'End Sem', 2023, 'Jun', '2b', 'Draw an ER diagram for a university database with entities Student, Course and Faculty. Convert it into relational schema.', 10, 1, ['ER model', 'ER diagram', 'relational schema'], 'Apply'),
  Q('CS403', 'End Sem', 2023, 'Jun', '3a', 'What is normalization? Explain why 3NF is preferred over 2NF with an example.', 8, 3, ['normalization', 'normal forms'], 'Understand'),
  Q('CS403', 'End Sem', 2023, 'Jun', '4b', 'Explain B+ tree indexing. Insert keys 10, 20, 30, 40, 50 into a B+ tree of order 3.', 10, 5, ['indexing', 'B+ tree', 'file organization'], 'Apply'),
  Q('CS403', 'End Sem', 2023, 'Jun', '5b', 'Explain relational algebra operations: selection, projection, join and division with examples.', 10, 2, ['relational algebra', 'join', 'operations'], 'Understand'),
  Q('CS403', 'End Sem', 2022, 'Jul', '3a', 'Explain the concept of a transaction. Describe the states of a transaction with a state diagram.', 8, 4, ['transaction', 'transaction states'], 'Understand'),
  Q('CS403', 'End Sem', 2022, 'Jul', '6a', 'What is deadlock in a database? Explain deadlock detection and prevention techniques.', 8, 4, ['deadlock', 'concurrency control', 'transaction'], 'Understand'),

  // ── CS501 Operating Systems ──────────────────────────────────────────────
  Q('CS501', 'End Sem', 2024, 'Jan', '4a', "Explain the necessary conditions for deadlock. Illustrate the Banker's algorithm with a suitable example.", 10, 4, ['deadlock', 'bankers algorithm', 'deadlock avoidance'], 'Apply'),
  Q('CS501', 'End Sem', 2024, 'Jan', '4b', 'Differentiate between deadlock prevention and deadlock avoidance.', 6, 4, ['deadlock', 'deadlock prevention', 'deadlock avoidance'], 'Analyze'),
  Q('CS501', 'End Sem', 2024, 'Jan', '2a', 'Explain FCFS, SJF and Round Robin scheduling. Compute average waiting time for the given process set.', 10, 2, ['CPU scheduling', 'FCFS', 'SJF', 'round robin'], 'Apply'),
  Q('CS501', 'End Sem', 2024, 'Jan', '3a', 'What is a critical section problem? Explain the reader-writer problem using semaphores.', 10, 3, ['synchronization', 'critical section', 'semaphore', 'reader writer'], 'Understand'),
  Q('CS501', 'End Sem', 2024, 'Jan', '5a', 'Explain paging with a neat diagram. How is logical address translated to physical address?', 10, 5, ['memory management', 'paging', 'address translation'], 'Understand'),
  Q('CS501', 'End Sem', 2024, 'Jan', '6b', 'Explain FIFO, LRU and Optimal page replacement for the reference string 7,0,1,2,0,3,0,4,2,3 with 3 frames.', 10, 5, ['virtual memory', 'page replacement', 'LRU', 'FIFO'], 'Apply'),

  Q('CS501', 'End Sem', 2023, 'Jan', '4a', 'Define deadlock. Explain the resource allocation graph with examples of deadlock and no deadlock.', 8, 4, ['deadlock', 'resource allocation graph'], 'Understand'),
  Q('CS501', 'End Sem', 2023, 'Jan', '4b', "Apply the Banker's algorithm to the given system state and determine whether it is in a safe state.", 10, 4, ['deadlock', 'bankers algorithm', 'safe state'], 'Apply'),
  Q('CS501', 'End Sem', 2023, 'Jan', '2b', 'Explain process states with a state transition diagram. What is a process control block?', 8, 1, ['process', 'process states', 'PCB'], 'Understand'),
  Q('CS501', 'End Sem', 2023, 'Jan', '3b', "Explain the producer-consumer problem and its solution using semaphores.", 10, 3, ['synchronization', 'producer consumer', 'semaphore'], 'Apply'),
  Q('CS501', 'End Sem', 2023, 'Jan', '6a', 'Explain segmentation. Compare paging and segmentation.', 8, 5, ['memory management', 'segmentation', 'paging'], 'Analyze'),
  Q('CS501', 'End Sem', 2023, 'Jan', '7a', 'Explain different file allocation methods with their advantages and disadvantages.', 10, 6, ['file system', 'file allocation'], 'Understand'),

  Q('CS501', 'CIE II', 2024, 'Nov', '2a', 'Explain deadlock detection algorithm for multiple instances of resource types.', 6, 4, ['deadlock', 'deadlock detection'], 'Understand'),
  Q('CS501', 'End Sem', 2022, 'Feb', '4a', 'What is deadlock? Explain the four necessary conditions with examples.', 8, 4, ['deadlock', 'deadlock conditions'], 'Understand'),
  Q('CS501', 'End Sem', 2022, 'Feb', '5b', 'Explain thrashing. What is the working set model?', 8, 5, ['virtual memory', 'thrashing', 'working set'], 'Understand'),
  Q('CS501', 'End Sem', 2022, 'Feb', '2a', 'Differentiate between process and thread. Explain multithreading models.', 8, 1, ['process', 'thread', 'multithreading'], 'Analyze'),
  Q('CS501', 'End Sem', 2025, 'Jan', '5a', 'Explain container based virtualization. How does it differ from hypervisor based virtualization?', 10, 7, ['virtualization', 'containers', 'docker'], 'Analyze'),
  Q('CS501', 'End Sem', 2025, 'Jan', '2b', 'Explain real time scheduling. Compare rate monotonic scheduling and earliest deadline first.', 10, 2, ['CPU scheduling', 'real time scheduling', 'EDF', 'rate monotonic'], 'Analyze'),
  Q('CS501', 'End Sem', 2025, 'Jan', '4a', "Illustrate the Banker's algorithm for a system with 5 processes and 3 resource types.", 10, 4, ['deadlock', 'bankers algorithm', 'deadlock avoidance'], 'Apply'),

  // ── CS502 Computer Networks ──────────────────────────────────────────────
  Q('CS502', 'End Sem', 2024, 'Jan', '2a', 'Explain the OSI reference model with the functions of each layer.', 10, 1, ['OSI model', 'network layers'], 'Understand'),
  Q('CS502', 'End Sem', 2024, 'Jan', '3a', 'Explain TCP three way handshake for connection establishment with a diagram.', 8, 4, ['TCP', 'connection establishment', 'transport layer'], 'Understand'),
  Q('CS502', 'End Sem', 2024, 'Jan', '4a', 'Explain distance vector routing. Illustrate the count to infinity problem.', 10, 3, ['routing', 'distance vector', 'network layer'], 'Analyze'),
  Q('CS502', 'End Sem', 2024, 'Jan', '5b', 'Given the IP address 192.168.10.0/24, divide it into 4 subnets and list the ranges.', 8, 3, ['IP addressing', 'subnetting', 'network layer'], 'Apply'),
  Q('CS502', 'End Sem', 2023, 'Jan', '3b', 'Explain CRC error detection with the generator polynomial x^3+x+1 for the data 1101011.', 8, 2, ['error detection', 'CRC', 'data link layer'], 'Apply'),
  Q('CS502', 'End Sem', 2023, 'Jan', '4b', 'Compare TCP and UDP. When would you prefer UDP over TCP?', 8, 4, ['TCP', 'UDP', 'transport layer'], 'Analyze'),
  Q('CS502', 'End Sem', 2023, 'Jan', '6a', 'Explain congestion control in TCP: slow start, congestion avoidance and fast retransmit.', 10, 4, ['TCP', 'congestion control', 'transport layer'], 'Understand'),
  Q('CS502', 'End Sem', 2022, 'Feb', '5a', 'Explain the working of DNS with an iterative and recursive query example.', 8, 5, ['DNS', 'application layer'], 'Understand'),

  // ── CS601 Machine Learning ───────────────────────────────────────────────
  Q('CS601', 'End Sem', 2024, 'Jun', '2a', 'Explain linear regression. Derive the least squares solution for the regression coefficients.', 10, 2, ['linear regression', 'supervised learning', 'least squares'], 'Analyze'),
  Q('CS601', 'End Sem', 2024, 'Jun', '3a', 'Explain the ID3 decision tree algorithm. Compute the information gain for the given dataset.', 10, 3, ['decision tree', 'ID3', 'information gain', 'supervised learning'], 'Apply'),
  Q('CS601', 'End Sem', 2024, 'Jun', '4b', 'What is overfitting? Explain regularization techniques to reduce overfitting.', 8, 4, ['overfitting', 'regularization', 'model evaluation'], 'Understand'),
  Q('CS601', 'End Sem', 2024, 'Jun', '5a', 'Explain the k-means clustering algorithm with an example. State its limitations.', 10, 5, ['clustering', 'k-means', 'unsupervised learning'], 'Apply'),
  Q('CS601', 'End Sem', 2023, 'Jun', '3b', 'Explain the backpropagation algorithm for training a multilayer neural network.', 10, 4, ['neural network', 'backpropagation', 'deep learning'], 'Understand'),
  Q('CS601', 'End Sem', 2023, 'Jun', '2b', "Explain Bayes theorem. Apply the naive Bayes classifier to the given training data.", 10, 2, ['bayesian', 'naive bayes', 'classification'], 'Apply'),
  Q('CS601', 'End Sem', 2023, 'Jun', '6a', 'Explain support vector machines. What is the kernel trick?', 10, 5, ['SVM', 'kernel', 'classification'], 'Understand'),

  // ── CS303 OOP with Java ──────────────────────────────────────────────────
  Q('CS303', 'End Sem', 2024, 'Jan', '2a', 'Explain inheritance in Java with an example. What is method overriding?', 8, 2, ['inheritance', 'polymorphism', 'java'], 'Understand'),
  Q('CS303', 'End Sem', 2024, 'Jan', '3b', 'Explain exception handling in Java with try, catch, finally and throw. Write a program demonstrating custom exceptions.', 10, 3, ['exception handling', 'java'], 'Apply'),
  Q('CS303', 'End Sem', 2024, 'Jan', '4a', 'Explain multithreading in Java. Write a program to create threads using the Runnable interface.', 10, 4, ['multithreading', 'thread', 'java'], 'Apply'),
  Q('CS303', 'End Sem', 2023, 'Jan', '2b', 'Differentiate between abstract class and interface with examples.', 8, 2, ['abstract class', 'interface', 'java'], 'Analyze'),
  Q('CS303', 'End Sem', 2023, 'Jan', '5a', 'Explain the Java collections framework. Compare ArrayList and LinkedList.', 8, 5, ['collections', 'ArrayList', 'LinkedList', 'java'], 'Analyze'),

  // ── IS304 Data Structures (ISE) ──────────────────────────────────────────
  Q('IS304', 'End Sem', 2024, 'Jan', '5a', 'Construct a binary search tree for the given sequence and analyze its worst case height.', 10, 3, ['binary search tree', 'binary tree', 'complexity analysis'], 'Analyze'),
  Q('IS304', 'End Sem', 2024, 'Jan', '5b', 'Write an algorithm to delete a node from a binary search tree considering all three cases.', 8, 3, ['binary search tree', 'binary tree', 'deletion'], 'Apply'),
  Q('IS304', 'End Sem', 2023, 'Jan', '6a', 'Explain tree traversal techniques with a suitable binary tree example.', 8, 3, ['binary tree', 'tree traversal'], 'Understand'),
  Q('IS304', 'End Sem', 2023, 'Jan', '4b', 'Write a program to implement a queue using two stacks.', 8, 2, ['stack', 'queue', 'data structure operations'], 'Apply'),
  Q('IS304', 'End Sem', 2022, 'Feb', '7a', 'Explain graph traversal using DFS. Write the recursive algorithm.', 8, 5, ['graph', 'DFS', 'graph traversal', 'recursion'], 'Apply'),

  // ── IS404 Software Engineering ───────────────────────────────────────────
  Q('IS404', 'End Sem', 2024, 'Jun', '2a', 'Compare the waterfall model and the agile model of software development.', 8, 1, ['software process model', 'agile', 'waterfall'], 'Analyze'),
  Q('IS404', 'End Sem', 2024, 'Jun', '3a', 'Explain the different types of software testing: unit, integration, system and acceptance testing.', 10, 4, ['software testing', 'testing levels'], 'Understand'),
  Q('IS404', 'End Sem', 2024, 'Jun', '4b', 'What is requirement elicitation? Explain functional and non functional requirements with examples.', 8, 2, ['requirements engineering', 'SRS'], 'Understand'),
  Q('IS404', 'End Sem', 2023, 'Jun', '5a', 'Explain the COCOMO model for software cost estimation.', 8, 3, ['project management', 'cost estimation', 'COCOMO'], 'Apply'),
  Q('IS404', 'End Sem', 2025, 'Jun', '2b', 'Explain DevOps practices and continuous integration in modern software delivery.', 10, 1, ['devops', 'continuous integration', 'agile'], 'Understand'),

  // ── IS505 Web Technologies ───────────────────────────────────────────────
  Q('IS505', 'End Sem', 2024, 'Jan', '2a', 'Explain the structure of an HTML5 document. Describe semantic tags with examples.', 8, 1, ['HTML', 'web development'], 'Understand'),
  Q('IS505', 'End Sem', 2024, 'Jan', '4a', 'Explain the MVC architecture in web applications with a neat diagram.', 10, 3, ['MVC', 'web architecture'], 'Understand'),
  Q('IS505', 'End Sem', 2024, 'Jan', '5b', 'Write a PHP script to connect to a MySQL database and display all records from a table.', 10, 4, ['PHP', 'MySQL', 'server side'], 'Apply'),
  Q('IS505', 'End Sem', 2023, 'Jan', '3a', 'Explain AJAX. Write a JavaScript example that fetches data asynchronously from a server.', 10, 2, ['AJAX', 'JavaScript', 'asynchronous'], 'Apply'),
  Q('IS505', 'End Sem', 2025, 'Jan', '3b', 'Explain REST API design principles. Differentiate REST from GraphQL.', 10, 3, ['REST', 'API', 'GraphQL', 'web services'], 'Analyze'),

  // ── EC303 Digital Electronics ────────────────────────────────────────────
  Q('EC303', 'End Sem', 2024, 'Jan', '2a', 'Simplify the Boolean function F(A,B,C,D) = Σm(0,1,2,5,8,9,10) using a K-map.', 10, 1, ['boolean algebra', 'karnaugh map', 'minimization'], 'Apply'),
  Q('EC303', 'End Sem', 2024, 'Jan', '3a', 'Design a 4-bit binary to gray code converter using logic gates.', 10, 2, ['code converter', 'combinational circuit', 'logic gates'], 'Apply'),
  Q('EC303', 'End Sem', 2024, 'Jan', '4b', 'Explain the working of a JK flip flop with its truth table and characteristic equation.', 8, 3, ['flip flop', 'sequential circuit', 'JK flip flop'], 'Understand'),
  Q('EC303', 'End Sem', 2023, 'Jan', '5a', 'Design a MOD-10 synchronous counter using JK flip flops.', 10, 4, ['counter', 'sequential circuit', 'flip flop'], 'Apply'),
  Q('EC303', 'End Sem', 2023, 'Jan', '2b', 'Explain multiplexer and demultiplexer. Implement a full adder using a 8:1 multiplexer.', 10, 2, ['multiplexer', 'combinational circuit', 'full adder'], 'Apply'),

  // ── EC404 Signals and Systems ────────────────────────────────────────────
  Q('EC404', 'End Sem', 2024, 'Jun', '2a', 'Define linear time invariant systems. Determine whether the given system is linear and time invariant.', 10, 1, ['LTI system', 'linearity', 'time invariance'], 'Analyze'),
  Q('EC404', 'End Sem', 2024, 'Jun', '3a', 'Find the convolution of x(n) = {1,2,3,1} and h(n) = {1,1,1} using the graphical method.', 10, 2, ['convolution', 'discrete time', 'signal processing'], 'Apply'),
  Q('EC404', 'End Sem', 2024, 'Jun', '4b', 'State and prove the properties of the Fourier transform: linearity, time shifting and frequency shifting.', 10, 3, ['fourier transform', 'signal analysis'], 'Analyze'),
  Q('EC404', 'End Sem', 2023, 'Jun', '5a', 'Find the Z-transform of the given sequence and state its region of convergence.', 8, 4, ['z transform', 'region of convergence'], 'Apply'),

  // ── EC502 Microcontrollers ───────────────────────────────────────────────
  Q('EC502', 'End Sem', 2024, 'Jan', '2a', 'Explain the architecture of the 8051 microcontroller with a neat block diagram.', 10, 1, ['8051', 'microcontroller architecture'], 'Understand'),
  Q('EC502', 'End Sem', 2024, 'Jan', '3b', 'Write an 8051 assembly program to generate a square wave of 1 kHz using timer 0.', 10, 3, ['8051', 'timer', 'assembly programming'], 'Apply'),
  Q('EC502', 'End Sem', 2023, 'Jan', '4a', 'Explain interrupt handling in the 8051. List the interrupt vector addresses.', 8, 3, ['8051', 'interrupts'], 'Understand'),
  Q('EC502', 'End Sem', 2025, 'Jan', '5a', 'Explain the ARM Cortex-M architecture and compare it with the 8051.', 10, 5, ['ARM', 'cortex', 'microcontroller architecture'], 'Analyze'),

  // ── AI401 Artificial Intelligence ────────────────────────────────────────
  Q('AI401', 'End Sem', 2024, 'Jun', '2a', 'Explain the A* search algorithm. Prove that A* is optimal when the heuristic is admissible.', 10, 2, ['search algorithms', 'A star', 'heuristic'], 'Analyze'),
  Q('AI401', 'End Sem', 2024, 'Jun', '3a', 'Explain the minimax algorithm with alpha-beta pruning for game trees.', 10, 3, ['game playing', 'minimax', 'alpha beta pruning'], 'Apply'),
  Q('AI401', 'End Sem', 2024, 'Jun', '4b', 'Represent the given English statements in first order predicate logic and perform resolution.', 10, 4, ['knowledge representation', 'predicate logic', 'resolution'], 'Apply'),
  Q('AI401', 'End Sem', 2023, 'Jun', '2b', 'Compare BFS, DFS and uniform cost search in terms of completeness, optimality and complexity.', 10, 2, ['search algorithms', 'BFS', 'DFS', 'complexity analysis'], 'Analyze'),
  Q('AI401', 'End Sem', 2023, 'Jun', '5a', 'Explain constraint satisfaction problems. Solve the map colouring problem using backtracking.', 10, 5, ['constraint satisfaction', 'backtracking', 'map colouring'], 'Apply'),

  // ── AI502 Deep Learning ──────────────────────────────────────────────────
  Q('AI502', 'End Sem', 2024, 'Jan', '2a', 'Explain the architecture of a convolutional neural network. What is the role of pooling layers?', 10, 2, ['CNN', 'neural network', 'deep learning', 'pooling'], 'Understand'),
  Q('AI502', 'End Sem', 2024, 'Jan', '3a', 'Explain the vanishing gradient problem. How do LSTM networks address it?', 10, 3, ['RNN', 'LSTM', 'vanishing gradient', 'deep learning'], 'Analyze'),
  Q('AI502', 'End Sem', 2024, 'Jan', '4b', 'Explain dropout and batch normalization as regularization techniques.', 8, 4, ['regularization', 'dropout', 'batch normalization', 'deep learning'], 'Understand'),
  Q('AI502', 'End Sem', 2025, 'Jan', '5a', 'Explain the transformer architecture and the self attention mechanism.', 10, 5, ['transformer', 'attention', 'deep learning', 'NLP'], 'Understand'),
  Q('AI502', 'End Sem', 2025, 'Jan', '6b', 'What are large language models? Explain the role of pretraining and fine tuning.', 10, 5, ['LLM', 'pretraining', 'fine tuning', 'NLP'], 'Understand'),

  // ── EE303 Electrical Machines ────────────────────────────────────────────
  Q('EE303', 'End Sem', 2024, 'Jan', '2a', 'Explain the construction and working principle of a DC generator. Derive its EMF equation.', 10, 1, ['DC generator', 'EMF equation', 'electrical machines'], 'Analyze'),
  Q('EE303', 'End Sem', 2024, 'Jan', '3b', 'Explain the working of a three phase induction motor. What is slip?', 10, 3, ['induction motor', 'three phase', 'slip'], 'Understand'),
  Q('EE303', 'End Sem', 2023, 'Jan', '4a', 'Draw and explain the equivalent circuit of a single phase transformer. Derive the condition for maximum efficiency.', 10, 2, ['transformer', 'equivalent circuit', 'efficiency'], 'Analyze'),

  // ── EE402 Power Systems ──────────────────────────────────────────────────
  Q('EE402', 'End Sem', 2024, 'Jun', '2a', 'Explain the structure of a power system from generation to distribution with a single line diagram.', 8, 1, ['power system', 'generation', 'transmission'], 'Understand'),
  Q('EE402', 'End Sem', 2024, 'Jun', '3a', 'Derive the expression for the inductance of a three phase transmission line with unsymmetrical spacing.', 10, 2, ['transmission line', 'inductance', 'power system'], 'Analyze'),
  Q('EE402', 'End Sem', 2023, 'Jun', '5b', 'Explain the per unit system. State its advantages in power system analysis.', 8, 3, ['per unit system', 'power system analysis'], 'Understand'),

  // ── ME303 Thermodynamics ─────────────────────────────────────────────────
  Q('ME303', 'End Sem', 2024, 'Jan', '2a', 'State and explain the first law of thermodynamics for a closed system undergoing a cycle.', 8, 1, ['first law', 'thermodynamics', 'closed system'], 'Understand'),
  Q('ME303', 'End Sem', 2024, 'Jan', '3a', 'Explain the Carnot cycle with P-V and T-S diagrams. Derive its efficiency.', 10, 2, ['carnot cycle', 'efficiency', 'thermodynamics'], 'Analyze'),
  Q('ME303', 'End Sem', 2024, 'Jan', '4b', 'State the second law of thermodynamics. Explain the Kelvin-Planck and Clausius statements.', 8, 3, ['second law', 'entropy', 'thermodynamics'], 'Understand'),
  Q('ME303', 'End Sem', 2023, 'Jan', '5a', 'Define entropy. Prove that entropy is a property of a system.', 8, 3, ['entropy', 'thermodynamics'], 'Analyze'),

  // ── ME404 Fluid Mechanics ────────────────────────────────────────────────
  Q('ME404', 'End Sem', 2024, 'Jun', '2a', "Derive Bernoulli's equation from Euler's equation of motion. State its assumptions.", 10, 2, ['bernoulli equation', 'fluid dynamics'], 'Analyze'),
  Q('ME404', 'End Sem', 2024, 'Jun', '3b', 'Explain laminar and turbulent flow. What is the significance of Reynolds number?', 8, 3, ['laminar flow', 'turbulent flow', 'reynolds number'], 'Understand'),
  Q('ME404', 'End Sem', 2023, 'Jun', '4a', 'Derive the continuity equation for three dimensional incompressible flow.', 10, 2, ['continuity equation', 'fluid dynamics'], 'Analyze'),

  // ── CV303 Structural Analysis ────────────────────────────────────────────
  Q('CV303', 'End Sem', 2024, 'Jan', '2a', 'Determine the bending moment and shear force diagram for the given simply supported beam.', 10, 1, ['bending moment', 'shear force', 'beam analysis'], 'Apply'),
  Q('CV303', 'End Sem', 2024, 'Jan', '3a', 'Analyze the given continuous beam using the moment distribution method.', 10, 3, ['moment distribution', 'continuous beam', 'structural analysis'], 'Apply'),
  Q('CV303', 'End Sem', 2023, 'Jan', '4b', 'Explain the slope deflection method. Derive the slope deflection equations.', 10, 2, ['slope deflection', 'structural analysis'], 'Analyze'),

  // ── CV402 Geotechnical Engineering ───────────────────────────────────────
  Q('CV402', 'End Sem', 2024, 'Jun', '2a', 'Explain the classification of soils as per IS code. Describe the Atterberg limits.', 8, 1, ['soil classification', 'atterberg limits', 'geotechnical'], 'Understand'),
  Q('CV402', 'End Sem', 2024, 'Jun', '3b', "Derive Darcy's law for flow through soils. Explain the factors affecting permeability.", 10, 2, ['darcy law', 'permeability', 'seepage'], 'Analyze'),
  Q('CV402', 'End Sem', 2023, 'Jun', '4a', "Explain Terzaghi's bearing capacity theory for shallow foundations.", 10, 4, ['bearing capacity', 'foundation', 'terzaghi'], 'Understand'),
];

export const notes = [
  { course: 'CS304', title: 'Data Structures — Complete Unit-wise Notes', kind: 'Handwritten', pages: 118, contributor: 'Sem 3 CSE batch', year: 2024 },
  { course: 'CS304', title: 'Trees and Graphs — Quick Revision Sheet', kind: 'Summary',     pages: 14,  contributor: 'Ananya R.',       year: 2024 },
  { course: 'CS304', title: 'Sorting Algorithms Cheat Sheet',           kind: 'Cheat sheet', pages: 6,   contributor: 'Karthik M.',      year: 2023 },
  { course: 'CS402', title: 'DAA — Dynamic Programming Worked Examples', kind: 'Solved',     pages: 42,  contributor: 'Prof. notes',     year: 2024 },
  { course: 'CS402', title: 'Algorithm Complexity Reference',            kind: 'Summary',     pages: 9,   contributor: 'Sneha P.',        year: 2023 },
  { course: 'CS403', title: 'DBMS — Normalization Made Simple',          kind: 'Summary',     pages: 22,  contributor: 'Rahul K.',        year: 2024 },
  { course: 'CS403', title: 'SQL Query Practice Set with Solutions',     kind: 'Solved',      pages: 36,  contributor: 'ISE study group', year: 2024 },
  { course: 'CS501', title: 'Operating Systems — Full Semester Notes',   kind: 'Handwritten', pages: 96,  contributor: 'Sem 5 CSE batch', year: 2024 },
  { course: 'CS501', title: 'Deadlock and Scheduling Problem Bank',      kind: 'Solved',      pages: 28,  contributor: 'Vikram S.',       year: 2025 },
  { course: 'CS502', title: 'Computer Networks — Layer-wise Summary',    kind: 'Summary',     pages: 31,  contributor: 'Meghana D.',      year: 2024 },
  { course: 'CS601', title: 'Machine Learning — Formula Sheet',          kind: 'Cheat sheet', pages: 11,  contributor: 'AIML batch',      year: 2024 },
  { course: 'CS303', title: 'Java Programming Lab Manual + Solutions',   kind: 'Solved',      pages: 54,  contributor: 'Lab batch B',     year: 2023 },
  { course: 'IS404', title: 'Software Engineering — Model Diagrams',     kind: 'Summary',     pages: 19,  contributor: 'Nikhil J.',       year: 2024 },
  { course: 'IS505', title: 'Web Technologies — Code Snippets Pack',     kind: 'Solved',      pages: 44,  contributor: 'Web dev club',    year: 2025 },
  { course: 'EC303', title: 'Digital Electronics — K-map Practice',      kind: 'Solved',      pages: 25,  contributor: 'Sem 3 ECE batch', year: 2024 },
  { course: 'EC404', title: 'Signals and Systems — Transform Tables',    kind: 'Cheat sheet', pages: 8,   contributor: 'Divya N.',        year: 2023 },
  { course: 'AI401', title: 'AI Search Algorithms — Visual Guide',       kind: 'Summary',     pages: 27,  contributor: 'AIML batch',      year: 2024 },
  { course: 'AI502', title: 'Deep Learning — Architecture Notes',        kind: 'Handwritten', pages: 63,  contributor: 'Arjun T.',        year: 2025 },
  { course: 'ME303', title: 'Thermodynamics — Derivations Compiled',     kind: 'Handwritten', pages: 71,  contributor: 'Sem 3 ME batch',  year: 2024 },
  { course: 'CV303', title: 'Structural Analysis — Solved Problem Set',  kind: 'Solved',      pages: 38,  contributor: 'Civil study group', year: 2024 },
];

// Syllabus versions power the change tracker. Each entry lists unit -> topics.
export const syllabusVersions = [
  {
    course: 'CS501', academicYear: '2024-25', effectiveFrom: 'Aug 2024',
    units: [
      { unit: 1, title: 'Introduction to Operating Systems', hours: 8, topics: ['OS structure and services', 'System calls', 'Process concept', 'Process control block', 'Batch operating system case studies'] },
      { unit: 2, title: 'Process Scheduling', hours: 8, topics: ['Scheduling criteria', 'FCFS and SJF', 'Priority scheduling', 'Round robin', 'Multilevel queue scheduling'] },
      { unit: 3, title: 'Process Synchronization', hours: 8, topics: ['Critical section problem', 'Semaphores', 'Producer consumer problem', 'Reader writer problem', 'Monitors'] },
      { unit: 4, title: 'Deadlocks', hours: 8, topics: ['Deadlock characterization', 'Resource allocation graph', 'Deadlock prevention', 'Deadlock avoidance and Banker algorithm', 'Deadlock detection and recovery'] },
      { unit: 5, title: 'Memory Management', hours: 8, topics: ['Contiguous allocation', 'Paging', 'Segmentation', 'Virtual memory and demand paging', 'Page replacement algorithms', 'Thrashing'] },
      { unit: 6, title: 'File and Storage Systems', hours: 6, topics: ['File concepts and access methods', 'Directory structure', 'File allocation methods', 'Disk scheduling'] },
    ],
  },
  {
    course: 'CS501', academicYear: '2025-26', effectiveFrom: 'Aug 2025',
    units: [
      { unit: 1, title: 'Introduction to Operating Systems', hours: 8, topics: ['OS structure and services', 'System calls', 'Process concept', 'Process control block', 'Threads and multithreading models'] },
      { unit: 2, title: 'Process Scheduling', hours: 8, topics: ['Scheduling criteria', 'FCFS and SJF', 'Priority scheduling', 'Round robin', 'Multilevel queue scheduling', 'Real time scheduling: rate monotonic and EDF'] },
      { unit: 3, title: 'Process Synchronization', hours: 8, topics: ['Critical section problem', 'Semaphores', 'Producer consumer problem', 'Reader writer problem', 'Monitors'] },
      { unit: 4, title: 'Deadlocks', hours: 8, topics: ['Deadlock characterization', 'Resource allocation graph', 'Deadlock prevention', 'Deadlock avoidance and Banker algorithm', 'Deadlock detection and recovery'] },
      { unit: 5, title: 'Memory Management', hours: 8, topics: ['Contiguous allocation', 'Paging', 'Segmentation', 'Virtual memory and demand paging', 'Page replacement algorithms', 'Thrashing'] },
      { unit: 6, title: 'File and Storage Systems', hours: 6, topics: ['File concepts and access methods', 'Directory structure', 'File allocation methods', 'Disk scheduling'] },
      { unit: 7, title: 'Virtualization and Containers', hours: 6, topics: ['Hypervisor based virtualization', 'Container based virtualization', 'Docker fundamentals', 'Container orchestration basics'] },
    ],
  },
  {
    course: 'CS403', academicYear: '2024-25', effectiveFrom: 'Aug 2024',
    units: [
      { unit: 1, title: 'Introduction and ER Model', hours: 8, topics: ['Database system architecture', 'Data independence', 'ER model and diagrams', 'Extended ER features'] },
      { unit: 2, title: 'Relational Model', hours: 8, topics: ['Relational algebra', 'Relational calculus', 'SQL basics', 'Nested queries', 'Aggregate functions'] },
      { unit: 3, title: 'Database Design', hours: 8, topics: ['Functional dependencies', 'First, second and third normal forms', 'BCNF', 'Lossless join decomposition'] },
      { unit: 4, title: 'Transaction Management', hours: 8, topics: ['Transaction concepts', 'ACID properties', 'Serializability', 'Two phase locking', 'Deadlock handling'] },
      { unit: 5, title: 'Storage and Indexing', hours: 8, topics: ['File organization', 'B trees and B+ trees', 'Hashing techniques', 'Query processing basics'] },
    ],
  },
  {
    course: 'CS403', academicYear: '2025-26', effectiveFrom: 'Aug 2025',
    units: [
      { unit: 1, title: 'Introduction and ER Model', hours: 8, topics: ['Database system architecture', 'Data independence', 'ER model and diagrams', 'Extended ER features'] },
      { unit: 2, title: 'Relational Model', hours: 8, topics: ['Relational algebra', 'SQL basics', 'Nested queries', 'Aggregate functions', 'Window functions'] },
      { unit: 3, title: 'Database Design', hours: 8, topics: ['Functional dependencies', 'First, second and third normal forms', 'BCNF', 'Lossless join decomposition'] },
      { unit: 4, title: 'Transaction Management', hours: 8, topics: ['Transaction concepts', 'ACID properties', 'Serializability', 'Two phase locking', 'Deadlock handling', 'Multiversion concurrency control'] },
      { unit: 5, title: 'Storage and Indexing', hours: 8, topics: ['File organization', 'B trees and B+ trees', 'Hashing techniques', 'Query processing basics'] },
      { unit: 6, title: 'NoSQL and Distributed Databases', hours: 6, topics: ['Document and key value stores', 'CAP theorem', 'Sharding and replication'] },
    ],
  },
  {
    course: 'CS304', academicYear: '2024-25', effectiveFrom: 'Aug 2024',
    units: [
      { unit: 1, title: 'Introduction to Data Structures', hours: 6, topics: ['Abstract data types', 'Arrays and structures', 'Pointers and dynamic memory'] },
      { unit: 2, title: 'Stacks, Queues and Linked Lists', hours: 8, topics: ['Stack operations and applications', 'Infix to postfix conversion', 'Circular queue', 'Singly and doubly linked lists'] },
      { unit: 3, title: 'Trees', hours: 10, topics: ['Binary tree representation', 'Tree traversal techniques', 'Binary search trees', 'Threaded binary trees', 'Expression trees'] },
      { unit: 4, title: 'Balanced Trees and Sorting', hours: 8, topics: ['AVL trees and rotations', 'Heaps and heap sort', 'Quick sort and merge sort'] },
      { unit: 5, title: 'Graphs and Hashing', hours: 8, topics: ['Graph representation', 'BFS and DFS', 'Minimum spanning tree', 'Hashing and collision resolution'] },
    ],
  },
  {
    course: 'CS304', academicYear: '2025-26', effectiveFrom: 'Aug 2025',
    units: [
      { unit: 1, title: 'Introduction to Data Structures', hours: 6, topics: ['Abstract data types', 'Arrays and structures', 'Pointers and dynamic memory', 'Time and space complexity basics'] },
      { unit: 2, title: 'Stacks, Queues and Linked Lists', hours: 8, topics: ['Stack operations and applications', 'Infix to postfix conversion', 'Circular queue', 'Singly and doubly linked lists'] },
      { unit: 3, title: 'Trees', hours: 10, topics: ['Binary tree representation', 'Tree traversal techniques', 'Binary search trees', 'Expression trees', 'Trie data structure'] },
      { unit: 4, title: 'Balanced Trees and Sorting', hours: 8, topics: ['AVL trees and rotations', 'Red black trees', 'Heaps and heap sort', 'Quick sort and merge sort'] },
      { unit: 5, title: 'Graphs and Hashing', hours: 8, topics: ['Graph representation', 'BFS and DFS', 'Minimum spanning tree', 'Hashing and collision resolution'] },
    ],
  },
];
