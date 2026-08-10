let expenses = JSON.parse(localStorage.getItem('expenses')) || [];
let activeGroup = JSON.parse(localStorage.getItem('activeGroup')) || null;
let userIncome = parseFloat(localStorage.getItem('userIncome')) || 0;
let categoryBudgets = JSON.parse(localStorage.getItem('categoryBudgets')) || {};
let myChart = null;

// ==========================================
// ⚡ 1. FIREBASE OFFLINE PERSISTENCE
// ==========================================
if (typeof db !== "undefined") {
    db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
        if (err.code === 'failed-precondition') {
            console.log('Multiple tabs open, persistence enabled in first tab.');
        } else if (err.code === 'unimplemented') {
            console.log('Browser does not support offline persistence.');
        }
    });
}

let currentUser = null;

// 🔒 SHA-256 Encryption Helper
async function hashPin(pin) {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 🎨 Helper Toast Notification
function showToast(icon, title) {
    if (typeof Swal !== "undefined") {
        Swal.fire({
            icon: icon,
            title: title,
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initDynamicIcon(); 
    initTheme();
    initLockSystem();  
    initFeatures();
    initCategoryBudgetSystem();
    initSplitSystem();
    initAuthSystem();
    renderExpenses();
    updateDashboard();

    loadExpensesFromFirebase();

    if (document.getElementById('date')) {
        document.getElementById('date').valueAsDate = new Date();
    }
});

// ==========================================
// 🌐 2. DYNAMIC ICON SWITCHER (FAVICON ONLY)
// ==========================================
function initDynamicIcon() {
    const onlineIconUrl = "https://cdn-icons-png.flaticon.com/512/2382/2382533.png"; 
    const offlineIconUrl = "logo.svg"; 

    const updateIcon = () => {
        const favicon = document.getElementById('appFavicon');

        if (navigator.onLine) {
            if (favicon) favicon.href = onlineIconUrl;
        } else {
            if (favicon) favicon.href = offlineIconUrl;
        }
    };

    updateIcon();
    window.addEventListener('online', updateIcon);
    window.addEventListener('offline', updateIcon);
}

// ==========================================
// 🔒 3. UPDATED SECURE LOCK SYSTEM
// ==========================================
function initLockSystem() {
    const lockScreen = document.getElementById('lockScreen');
    const unlockPinInput = document.getElementById('unlockPin');
    const oldPinInput = document.getElementById('oldPinInput');
    const verifyPinBtn = document.getElementById('verifyPinBtn');
    const resetPinBtn = document.getElementById('resetPinBtn');
    const disablePinBtn = document.getElementById('disablePinBtn');
    const openPinBtn = document.getElementById('openPinBtn');
    const lockTitle = document.getElementById('lockTitle');
    const lockSubText = document.getElementById('lockSubText');

    let savedPinHash = localStorage.getItem('userAppPinHash');
    let currentMode = 'UNLOCK';

    if (savedPinHash && lockScreen) {
        currentMode = 'UNLOCK';
        lockScreen.style.display = 'flex';
        lockTitle.textContent = '🔒 ऐप सुरक्षित है';
        lockSubText.textContent = 'कृपया अपना 4-अंकों का पिन दर्ज करें';
        if (oldPinInput) oldPinInput.style.display = 'none';
        if (unlockPinInput) {
            unlockPinInput.style.display = 'block';
            unlockPinInput.placeholder = '4-अंकों का पिन';
        }
        if (verifyPinBtn) verifyPinBtn.textContent = 'अनलॉक करें';
        if (disablePinBtn) disablePinBtn.style.display = 'inline-block';
    }

    if (openPinBtn) {
        openPinBtn.onclick = () => {
            savedPinHash = localStorage.getItem('userAppPinHash');
            lockScreen.style.display = 'flex';

            if (savedPinHash) {
                setFormMode('RESET');
            } else {
                setFormMode('NEW');
            }
        };
    }

    if (disablePinBtn) {
        disablePinBtn.onclick = () => {
            setFormMode('DISABLE');
        };
    }

    if (resetPinBtn) {
        resetPinBtn.onclick = () => {
            setFormMode('RESET');
        };
    }

    function setFormMode(mode) {
        currentMode = mode;
        if (unlockPinInput) unlockPinInput.value = '';
        if (oldPinInput) oldPinInput.value = '';

        if (mode === 'DISABLE') {
            lockTitle.textContent = '🚫 पिन सुरक्षा बंद करें';
            lockSubText.textContent = 'पिन हटाने के लिए केवल अपना पुराना पिन दर्ज करें';
            oldPinInput.style.display = 'block';
            oldPinInput.placeholder = 'पुराना पिन (Old PIN)';
            unlockPinInput.style.display = 'none';
            verifyPinBtn.textContent = 'पिन बताएं (Remove PIN)';
            if (disablePinBtn) disablePinBtn.style.display = 'none';
        } 
        else if (mode === 'RESET') {
            lockTitle.textContent = '🔑 पिन बदलें (Reset PIN)';
            lockSubText.textContent = 'पुराना और नया पिन दर्ज करें';
            oldPinInput.style.display = 'block';
            oldPinInput.placeholder = 'पुराना पिन';
            unlockPinInput.style.display = 'block';
            unlockPinInput.placeholder = 'नया 4-अंकों का पिन';
            verifyPinBtn.textContent = 'सत्यापित करें एवं बदलें';
            if (disablePinBtn) disablePinBtn.style.display = 'inline-block';
        }
        else if (mode === 'NEW') {
            lockTitle.textContent = '🔑 नया पिन बनाएं';
            lockSubText.textContent = 'नया 4-अंकों का पिन सेट करें';
            oldPinInput.style.display = 'none';
            unlockPinInput.style.display = 'block';
            unlockPinInput.placeholder = 'नया 4-अंकों का पिन';
            verifyPinBtn.textContent = 'नया पिन सेव करें';
            if (disablePinBtn) disablePinBtn.style.display = 'none';
        }
    }

    if (verifyPinBtn) {
        verifyPinBtn.onclick = async () => {
            const enteredPin = unlockPinInput.value.trim();
            const enteredOldPin = oldPinInput ? oldPinInput.value.trim() : '';

            if (currentMode === 'UNLOCK') {
                const inputHash = await hashPin(enteredPin);
                if (inputHash === savedPinHash) {
                    lockScreen.style.display = 'none';
                    unlockPinInput.value = '';
                    showToast('success', 'स्वागत है!');
                } else {
                    showToast('error', 'गलत पिन!');
                }
            } 
            else if (currentMode === 'DISABLE') {
                if (!enteredOldPin) {
                    showToast('warning', 'कृपया अपना पुराना पिन दर्ज करें!');
                    return;
                }
                const oldHash = await hashPin(enteredOldPin);
                if (oldHash !== savedPinHash) {
                    showToast('error', 'गलत पुराना पिन!');
                    return;
                }

                localStorage.removeItem('userAppPinHash');
                savedPinHash = null;
                lockScreen.style.display = 'none';
                if (oldPinInput) oldPinInput.value = '';
                showToast('info', '🔓 पिन सुरक्षा सफलतापूर्वक हटा दी गई है!');
            }
            else if (currentMode === 'RESET' || currentMode === 'NEW') {
                if (currentMode === 'RESET') {
                    const oldHash = await hashPin(enteredOldPin);
                    if (oldHash !== savedPinHash) {
                        showToast('error', 'गलत पुराना पिन!');
                        return;
                    }
                }

                if (enteredPin.length !== 4 || isNaN(enteredPin)) {
                    showToast('warning', 'कृपया 4 अंकों का सही पिन दर्ज करें!');
                    return;
                }

                const newHash = await hashPin(enteredPin);
                localStorage.setItem('userAppPinHash', newHash);
                savedPinHash = newHash;

                showToast('success', '🔒 नया पिन सुरक्षित रूप से सेट कर दिया गया!');
                lockScreen.style.display = 'none';
                unlockPinInput.value = '';
                if (oldPinInput) oldPinInput.value = '';
            }
        };
    }
}

// ==========================================
// 🔑 4. GOOGLE AUTHENTICATION SYSTEM
// ==========================================
function initAuthSystem() {
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const userInfo = document.getElementById('userInfo');
    const userName = document.getElementById('userName');

    if (loginBtn) {
        loginBtn.onclick = () => {
            if (typeof firebase === "undefined") {
                return showToast('error', "Firebase लोड नहीं हुआ है!");
            }
            if (typeof Swal !== "undefined") {
                Swal.fire({
                    title: 'लॉगइन हो रहा है...',
                    text: 'कृपया प्रतीक्षा करें',
                    allowOutsideClick: false,
                    didOpen: () => { Swal.showLoading(); }
                });
            }

            const provider = new firebase.auth.GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });

            firebase.auth().signInWithPopup(provider)
                .then((result) => {
                    if (typeof Swal !== "undefined") Swal.close();
                    showToast('success', `स्वागत है ${result.user.displayName}!`);
                })
                .catch((error) => {
                    if (typeof Swal !== "undefined") Swal.close();
                    showToast('error', "लॉगइन असफल: " + error.message);
                });
        };
    }

    if (logoutBtn) {
        logoutBtn.onclick = () => {
            firebase.auth().signOut().then(() => {
                showToast('info', "लॉगआउट सफल!");
            });
        };
    }

    if (typeof firebase !== "undefined" && firebase.auth) {
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                currentUser = user;
                if (loginBtn) loginBtn.style.display = 'none';
                if (userInfo) userInfo.style.display = 'flex';
                if (userName) userName.textContent = user.displayName;

                loadUserExpensesFromFirebase(user.uid);
                if (activeGroup && activeGroup.name) {
                    listenToGroupSync(activeGroup.name);
                }
            } else {
                currentUser = null;
                if (loginBtn) loginBtn.style.display = 'inline-block';
                if (userInfo) userInfo.style.display = 'none';
            }
        });
    }
}

// ==========================================
// 🔥 FIREBASE & CLOUD BACKUP
// ==========================================
function saveExpenseToFirebase(expenseObj) {
    if (typeof db !== "undefined") {
        if (currentUser) {
            db.collection("users").doc(currentUser.uid).collection("expenses").doc(String(expenseObj.id)).set({
                id: expenseObj.id,
                desc: expenseObj.desc,
                amount: expenseObj.amount,
                date: expenseObj.date,
                category: expenseObj.category,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        db.collection("सामान").doc(String(expenseObj.id)).set({
            id: expenseObj.id,
            desc: expenseObj.desc,
            amount: expenseObj.amount,
            date: expenseObj.date,
            category: expenseObj.category,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }
}

// 🎯 FIX: FIREBASE से सिंगल एक्सपेंस डिलीट करने के लिए
function deleteExpenseFromFirebase(id) {
    if (typeof db !== "undefined") {
        if (currentUser) {
            db.collection("users").doc(currentUser.uid).collection("expenses").doc(String(id)).delete()
                .then(() => console.log("User Expense Deleted from Firebase"))
                .catch(err => console.error("Error deleting user expense: ", err));
        }
        db.collection("सामान").doc(String(id)).delete()
            .then(() => console.log("Global Expense Deleted from Firebase"))
            .catch(err => console.error("Error deleting global expense: ", err));
    }
}

function loadExpensesFromFirebase() {
    if (typeof db !== "undefined") {
        db.collection("सामान").onSnapshot((snapshot) => {
            let firebaseExpenses = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                firebaseExpenses.push({
                    id: data.id || Number(doc.id) || Date.now(),
                    desc: data.desc,
                    amount: data.amount,
                    date: data.date,
                    category: data.category
                });
            });

            // फायरबेस से डेटा तभी सिंक करें जब फायरबेस में कोई डेटा हो
            if (firebaseExpenses.length > 0) {
                expenses = firebaseExpenses;
                localStorage.setItem('expenses', JSON.stringify(expenses));
                renderExpenses();
                updateDashboard();
            }
        });
    }
}

function loadUserExpensesFromFirebase(uid) {
    if (typeof db !== "undefined") {
        db.collection("users").doc(uid).collection("expenses").onSnapshot((snapshot) => {
            let userExpenses = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                userExpenses.push({
                    id: data.id || Number(doc.id) || Date.now(),
                    desc: data.desc,
                    amount: data.amount,
                    date: data.date,
                    category: data.category
                });
            });

            if (userExpenses.length > 0) {
                expenses = userExpenses;
                localStorage.setItem('expenses', JSON.stringify(expenses));
                renderExpenses();
                updateDashboard();
            }
        });
    }
}

function syncGroupToFirebase() {
    if (typeof db !== "undefined" && activeGroup) {
        db.collection("groups").doc(activeGroup.name).set(activeGroup);
    }
}

function listenToGroupSync(groupName) {
    if (typeof db !== "undefined") {
        db.collection("groups").doc(groupName).onSnapshot((doc) => {
            if (doc.exists) {
                activeGroup = doc.data();
                localStorage.setItem('activeGroup', JSON.stringify(activeGroup));
                showActiveGroupUI();
            }
        });
    }
}

// 🌙 Theme Toggle
function initTheme() {
    const toggleBtn = document.getElementById('toggleThemeBtn');
    const savedTheme = localStorage.getItem('appTheme') || 'dark';

    if (savedTheme === 'light') {
        document.body.classList.remove('dark-theme');
        if (toggleBtn) toggleBtn.textContent = '🌙 Dark';
    } else {
        document.body.classList.add('dark-theme');
        if (toggleBtn) toggleBtn.textContent = '☀️ Light';
    }

    if (toggleBtn) {
        toggleBtn.onclick = () => {
            const isDark = document.body.classList.toggle('dark-theme');
            localStorage.setItem('appTheme', isDark ? 'dark' : 'light');
            toggleBtn.textContent = isDark ? '☀️ Light' : '🌙 Dark';
        };
    }
}

// 🎯 Category Budget System
function initCategoryBudgetSystem() {
    const setLimitBtn = document.getElementById('setCategoryBudgetBtn');
    const categorySelect = document.getElementById('budgetCategorySelect');
    const limitInput = document.getElementById('categoryBudgetLimit');

    if (setLimitBtn) {
        setLimitBtn.onclick = () => {
            const cat = categorySelect.value;
            const limitVal = parseFloat(limitInput.value);

            if (isNaN(limitVal) || limitVal <= 0) {
                return showToast('warning', 'सही बजट राशि दर्ज करें!');
            }

            categoryBudgets[cat] = limitVal;
            localStorage.setItem('categoryBudgets', JSON.stringify(categoryBudgets));
            limitInput.value = '';
            showToast('success', `${cat} लिमिट ₹${limitVal} सेट हो गई!`);
            updateDashboard();
        };
    }
}

function deleteCategoryBudget(categoryName) {
    if (categoryBudgets[categoryName] !== undefined) {
        delete categoryBudgets[categoryName];
        localStorage.setItem('categoryBudgets', JSON.stringify(categoryBudgets));
        showToast('info', `${categoryName} का बजट लिमिट हटा दिया गया`);
        updateDashboard();
    }
}

function checkCategoryBudgetStatus() {
    const alertsDiv = document.getElementById('categoryBudgetAlerts');
    const currency = document.getElementById('currencySymbol') ? document.getElementById('currencySymbol').value : '₹';
    if (!alertsDiv) return;

    alertsDiv.innerHTML = '';
    Object.keys(categoryBudgets).forEach(cat => {
        const limit = categoryBudgets[cat];
        const spent = expenses.filter(e => e.category === cat).reduce((sum, e) => sum + e.amount, 0);

        let statusText = '';
        if (spent > limit) {
            statusText = `<div style="color:#dc3545; font-weight:bold; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
                <span>⚠️ <strong>${cat}:</strong> बजट सीमा पार! (${currency}${spent}/${currency}${limit})</span>
                <button onclick="deleteCategoryBudget('${cat}')" style="background:none; border:none; color:#ff6b6b; cursor:pointer; font-size:1rem; margin-left:10px;" title="बजट हटाएं">🗑️</button>
            </div>`;
        } else if (spent >= limit * 0.8) {
            statusText = `<div style="color:#ffc107; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
                <span>⚡ <strong>${cat}:</strong> 80% बजट पूरा (${currency}${spent}/${currency}${limit})</span>
                <button onclick="deleteCategoryBudget('${cat}')" style="background:none; border:none; color:#ff6b6b; cursor:pointer; font-size:1rem; margin-left:10px;" title="बजट हटाएं">🗑️</button>
            </div>`;
        } else {
            statusText = `<div style="color:#28a745; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
                <span>🟢 <strong>${cat}:</strong> ${currency}${spent} / ${currency}${limit}</span>
                <button onclick="deleteCategoryBudget('${cat}')" style="background:none; border:none; color:#ff6b6b; cursor:pointer; font-size:1rem; margin-left:10px;" title="बजट हटाएं">🗑️</button>
            </div>`;
        }
        alertsDiv.innerHTML += statusText;
    });
}

// 🚀 Core Features & Auto Category
function initFeatures() {
    const saveBudgetBtn = document.getElementById('saveBudgetBtn');
    const incomeInput = document.getElementById('incomeInput');
    const currencySelect = document.getElementById('currencySymbol');

    if (userIncome && incomeInput) incomeInput.value = userIncome;
    const savedCurrency = localStorage.getItem('userCurrency');
    if (savedCurrency && currencySelect) currencySelect.value = savedCurrency;

    if (currencySelect) {
        currencySelect.onchange = () => {
            localStorage.setItem('userCurrency', currencySelect.value);
            renderExpenses();
            updateDashboard();
            if (activeGroup) calculateGroupSettlement();
        };
    }

    if (saveBudgetBtn) {
        saveBudgetBtn.onclick = () => {
            const val = parseFloat(incomeInput.value);
            if (!isNaN(val) && val >= 0) {
                userIncome = val;
                localStorage.setItem('userIncome', userIncome);
                updateDashboard();
                showToast('success', 'मासिक आय सेव हो गई!');
            }
        };
    }

    const descInput = document.getElementById('desc');
    if (descInput) {
        descInput.addEventListener('input', (e) => {
            const text = e.target.value.toLowerCase().trim();
            const categorySelect = document.getElementById('category');

            if (!text) { categorySelect.value = 'अन्य'; return; }

            const foodWords = ['rice', 'food', 'dal', 'kirana', 'pizza', 'zomato', 'swiggy', 'tea', 'milk', 'khana', 'hotel', 'chai', 'lunch', 'dinner', 'ration', 'राशन', 'खाना'];
            const travelWords = ['petrol', 'diesel', 'cab', 'auto', 'uber', 'ola', 'bus', 'train', 'ticket', 'fuel', 'yatra', 'पेट्रोल', 'डीजल'];
            const billWords = ['rent', 'electricity', 'recharge', 'wifi', 'mobile', 'bill', 'water', 'किराया', 'बिजली', 'बिल'];
            const shoppingWords = ['shirt', 'pant', 'clothes', 'shoes', 'amazon', 'flipkart', 'कपड़े', 'खरीदारी'];
            const medicalWords = ['medicine', 'doctor', 'dawai', 'clinic', 'दवाई', 'डॉक्टर'];
            const eduWords = ['fee', 'school', 'college', 'book', 'pen', 'tuition', 'फीस', 'किताब'];

            if (foodWords.some(w => text.includes(w))) categorySelect.value = 'खाना';
            else if (travelWords.some(w => text.includes(w))) categorySelect.value = 'यात्रा';
            else if (billWords.some(w => text.includes(w))) categorySelect.value = 'बिल/किराया';
            else if (shoppingWords.some(w => text.includes(w))) categorySelect.value = 'खरीदारी';
            else if (medicalWords.some(w => text.includes(w))) categorySelect.value = 'दवाई';
            else if (eduWords.some(w => text.includes(w))) categorySelect.value = 'शिक्षा';
            else categorySelect.value = 'अन्य';
        });
    }

    if (document.getElementById('searchInput')) document.getElementById('searchInput').oninput = renderExpenses;
    if (document.getElementById('filterCategory')) document.getElementById('filterCategory').onchange = renderExpenses;
    if (document.getElementById('downloadPdfBtn')) document.getElementById('downloadPdfBtn').onclick = generatePDF;
    if (document.getElementById('downloadReportBtn')) document.getElementById('downloadReportBtn').onclick = generateCSV;
    
    if (document.getElementById('downloadGroupPdfBtn')) {
        document.getElementById('downloadGroupPdfBtn').onclick = generateGroupPDF;
    }

    // 🎯 Clear All Button (केवल इस पर क्लिक करने से ही सब कुछ हटेगा)
    if (document.getElementById('clearAllBtn')) {
        document.getElementById('clearAllBtn').onclick = () => {
            if (confirm('क्या आप अपना पूरा डेटा और ग्रुप डिलीट करना चाहते हैं?')) {
                expenses = [];
                activeGroup = null;
                userIncome = 0;
                categoryBudgets = {};
                localStorage.clear();
                renderExpenses();
                updateDashboard();
                location.reload();
            }
        };
    }
}

// ✏️ Add & Edit Expense
if (document.getElementById('addExpenseBtn')) {
    document.getElementById('addExpenseBtn').onclick = () => {
        const desc = document.getElementById('desc').value.trim();
        const amount = parseFloat(document.getElementById('amount').value);
        const date = document.getElementById('date').value;
        const category = document.getElementById('category').value;
        const editId = document.getElementById('editExpenseId').value;

        if (!desc || isNaN(amount) || amount <= 0) {
            return showToast('warning', 'विवरण और सही रकम दर्ज करें!');
        }

        let newOrUpdatedExpense;

        if (editId) {
            const index = expenses.findIndex(e => String(e.id) === String(editId));
            if (index !== -1) {
                newOrUpdatedExpense = { id: expenses[index].id, desc, amount, date, category };
                expenses[index] = newOrUpdatedExpense;
                showToast('success', 'खर्च अपडेट हुआ!');
            }
            resetExpenseForm();
        } else {
            newOrUpdatedExpense = { id: Date.now(), desc, amount, date, category };
            expenses.push(newOrUpdatedExpense);
            showToast('success', 'खर्च जोड़ दिया गया!');
        }

        localStorage.setItem('expenses', JSON.stringify(expenses));
        if (newOrUpdatedExpense) saveExpenseToFirebase(newOrUpdatedExpense);
        
        document.getElementById('desc').value = '';
        document.getElementById('amount').value = '';
        renderExpenses();
        updateDashboard();
    };
}

if (document.getElementById('cancelEditBtn')) {
    document.getElementById('cancelEditBtn').onclick = resetExpenseForm;
}

function resetExpenseForm() {
    if (document.getElementById('editExpenseId')) document.getElementById('editExpenseId').value = '';
    if (document.getElementById('desc')) document.getElementById('desc').value = '';
    if (document.getElementById('amount')) document.getElementById('amount').value = '';
    if (document.getElementById('formTitle')) document.getElementById('formTitle').textContent = '➕ अपना व्यक्तिगत खर्च जोड़ें';
    if (document.getElementById('addExpenseBtn')) document.getElementById('addExpenseBtn').textContent = 'खर्च जोड़ें';
    if (document.getElementById('cancelEditBtn')) document.getElementById('cancelEditBtn').style.display = 'none';
}

function renderExpenses() {
    const list = document.getElementById('expenseList');
    if (!list) return;

    const search = document.getElementById('searchInput') ? document.getElementById('searchInput').value.toLowerCase() : '';
    const filter = document.getElementById('filterCategory') ? document.getElementById('filterCategory').value : 'सभी';
    const currency = document.getElementById('currencySymbol') ? document.getElementById('currencySymbol').value : '₹';

    list.innerHTML = '';

    let filtered = expenses.filter(e => {
        const matchesSearch = e.desc.toLowerCase().includes(search);
        const matchesFilter = filter === 'सभी' || e.category === filter;
        return matchesSearch && matchesFilter;
    });

    if (filtered.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:#777; font-size:0.85rem; padding: 10px;">कोई खर्च नहीं मिला।</p>';
        return;
    }

    filtered.forEach(item => {
        const div = document.createElement('div');
        div.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:10px 12px; margin-bottom:8px; background:#2a2a2a; border-radius:8px; color:#fff; font-size:0.85rem;';
        
        div.innerHTML = `
            <div>
                <strong>${item.desc}</strong> (${item.category})<br>
                <small style="color:#aaa;">${item.date}</small>
            </div>
            <div>
                <span style="color:#dc3545; font-weight:bold;">${currency}${item.amount}</span> 
                <button class="edit-btn" style="background:none; border:none; color:#ffc107; cursor:pointer; margin-left:8px;">✏️</button>
                <button class="del-btn" style="background:none; border:none; color:#ff6b6b; cursor:pointer; margin-left:4px;">🗑️</button>
            </div>
        `;

        div.querySelector('.edit-btn').onclick = () => startEditExpense(item.id);
        div.querySelector('.del-btn').onclick = () => deleteExp(item.id);

        list.appendChild(div);
    });
}

function startEditExpense(id) {
    const exp = expenses.find(e => String(e.id) === String(id));
    if (!exp) return;

    document.getElementById('editExpenseId').value = exp.id;
    document.getElementById('desc').value = exp.desc;
    document.getElementById('amount').value = exp.amount;
    document.getElementById('date').value = exp.date;
    document.getElementById('category').value = exp.category;

    document.getElementById('formTitle').textContent = '✏️ खर्च संशोधित करें';
    document.getElementById('addExpenseBtn').textContent = 'अपडेट करें';
    document.getElementById('cancelEditBtn').style.display = 'inline-block';
}

// 🎯 FIX: केवल एक सिंगल खर्च (Expense) डिलीट करने का फंक्शन
function deleteExp(id) {
    if (confirm('क्या आप इस खर्च को हटाना चाहते हैं?')) {
        // 1. एरे में से केवल उसी ID वाली आइटम को फ़िल्टर करके हटाएँ
        expenses = expenses.filter(i => String(i.id) !== String(id));

        // 2. LocalStorage में नया एरे अपडेट करें
        localStorage.setItem('expenses', JSON.stringify(expenses));

        // 3. Firebase Database से भी इस विशिष्ट id को डिलीट करें
        deleteExpenseFromFirebase(id);

        // 4. UI और Dashboard तुरंत अपडेट करें
        renderExpenses();
        updateDashboard();

        showToast('info', 'खर्च सफलतापूर्वक हटा दिया गया');
    }
}

function updateDashboard() {
    const currencyElem = document.getElementById('currencySymbol');
    const currency = currencyElem ? currencyElem.value : '₹';
    
    const totalExp = expenses.reduce((sum, i) => sum + i.amount, 0);
    const savings = userIncome - totalExp;

    if (document.getElementById('displayIncome')) document.getElementById('displayIncome').textContent = `${currency}${userIncome}`;
    if (document.getElementById('totalExpense')) document.getElementById('totalExpense').textContent = `${currency}${totalExp}`;
    
    const savingsElem = document.getElementById('netSavings');
    if (savingsElem) {
        savingsElem.textContent = `${currency}${savings}`;
        savingsElem.className = savings >= 0 ? 'text-success' : 'text-danger';
    }

    renderChart();
    checkCategoryBudgetStatus();
}

function renderChart() {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;

    const categories = ['खाना', 'यात्रा', 'मनोरंजन', 'बिल/किराया', 'खरीदारी', 'दवाई', 'शिक्षा', 'अन्य'];
    const totals = categories.map(cat => expenses.filter(e => e.category === cat).reduce((sum, e) => sum + e.amount, 0));

    if (myChart) myChart.destroy();

    myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: categories,
            datasets: [{
                data: totals,
                backgroundColor: ['#ff6384', '#36a2eb', '#cc65fe', '#ffce56', '#4bc0c0', '#9966ff', '#ff9f40', '#c9cbcf']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });
}

// 👥 GROUP SPLITTER SYSTEM
function initSplitSystem() {
    const createGroupBtn = document.getElementById('createGroupBtn');
    const addSplitBtn = document.getElementById('addSplitExpenseBtn');
    const deleteGroupBtn = document.getElementById('deleteGroupBtn');

    if (activeGroup) showActiveGroupUI();

    if (createGroupBtn) {
        createGroupBtn.onclick = () => {
            const name = document.getElementById('groupName').value.trim();
            const membersInput = document.getElementById('groupMembers').value.trim();

            if (!name || !membersInput) return showToast('warning', 'ग्रुप का नाम और सदस्य दर्ज करें!');
            const members = membersInput.split(',').map(m => m.trim()).filter(m => m.length > 0);
            if (members.length < 2) return showToast('warning', 'कम से कम 2 सदस्य दर्ज करें!');

            activeGroup = { name: name, members: members, expenses: [] };
            localStorage.setItem('activeGroup', JSON.stringify(activeGroup));
            
            syncGroupToFirebase();
            listenToGroupSync(name);

            showActiveGroupUI();
            showToast('success', 'ग्रुप बन गया!');
        };
    }

    if (addSplitBtn) {
        addSplitBtn.onclick = () => {
            const desc = document.getElementById('splitDesc').value.trim();
            const amount = parseFloat(document.getElementById('splitAmount').value);
            const paidBy = document.getElementById('paidBySelect').value;

            if (!desc || isNaN(amount) || amount <= 0) return showToast('warning', 'सही रकम दर्ज करें!');

            activeGroup.expenses.push({ id: Date.now(), desc, amount, paidBy });
            localStorage.setItem('activeGroup', JSON.stringify(activeGroup));

            syncGroupToFirebase();

            document.getElementById('splitDesc').value = '';
            document.getElementById('splitAmount').value = '';
            calculateGroupSettlement();
            showToast('success', 'खर्च जुड़ गया!');
        };
    }

    if (deleteGroupBtn) {
        deleteGroupBtn.onclick = () => {
            if (confirm('क्या आप ग्रुप डिलीट करना चाहते हैं?')) {
                if (typeof db !== "undefined" && activeGroup) {
                    db.collection("groups").doc(activeGroup.name).delete();
                }
                activeGroup = null;
                localStorage.removeItem('activeGroup');
                if (document.getElementById('createGroupBox')) document.getElementById('createGroupBox').style.display = 'block';
                if (document.getElementById('splitExpenseForm')) document.getElementById('splitExpenseForm').style.display = 'none';
                if (document.getElementById('settlementReport')) document.getElementById('settlementReport').innerHTML = '';
                if (document.getElementById('downloadGroupPdfBtn')) document.getElementById('downloadGroupPdfBtn').style.display = 'none';
                showToast('info', 'ग्रुप डिलीट हो गया');
            }
        };
    }
}

function showActiveGroupUI() {
    if (document.getElementById('createGroupBox')) document.getElementById('createGroupBox').style.display = 'none';
    const form = document.getElementById('splitExpenseForm');
    const title = document.getElementById('activeGroupName');
    const select = document.getElementById('paidBySelect');

    if (form) form.style.display = 'block';
    if (title) title.textContent = `ग्रुप: ${activeGroup.name}`;

    if (select) {
        select.innerHTML = '';
        activeGroup.members.forEach(member => {
            const option = document.createElement('option');
            option.value = member;
            option.textContent = `${member} ने पैसे दिए`;
            select.appendChild(option);
        });
    }

    if (document.getElementById('downloadGroupPdfBtn')) document.getElementById('downloadGroupPdfBtn').style.display = 'block';
    calculateGroupSettlement();
}

function calculateGroupSettlement() {
    const reportDiv = document.getElementById('settlementReport');
    if (!reportDiv) return;
    
    reportDiv.innerHTML = '';

    if (!activeGroup || activeGroup.expenses.length === 0) {
        reportDiv.innerHTML = '<em>ग्रुप में कोई खर्च नहीं जुड़ा है।</em>';
        return;
    }

    const balances = {};
    activeGroup.members.forEach(m => balances[m] = 0);
    let totalGroupExpense = 0;
    const currency = document.getElementById('currencySymbol') ? document.getElementById('currencySymbol').value : '₹';

    let groupListHtml = `<div style="margin-bottom:12px;"><strong>📝 ग्रुप के खर्च:</strong><br>`;
    activeGroup.expenses.forEach(exp => {
        totalGroupExpense += exp.amount;
        const splitShare = exp.amount / activeGroup.members.length;

        activeGroup.members.forEach(m => {
            if (m === exp.paidBy) balances[m] += (exp.amount - splitShare);
            else balances[m] -= splitShare;
        });

        groupListHtml += `
            <div style="display:flex; justify-content:space-between; font-size:0.8rem; background:rgba(255,255,255,0.05); padding:4px 8px; border-radius:4px; margin-top:4px;">
                <span>🔹 <strong>${exp.desc}</strong> (${exp.paidBy}): ${currency}${exp.amount}</span>
            </div>`;
    });
    groupListHtml += `</div><hr style="margin:8px 0; border-color:#555;">`;

    let settlementHtml = `<strong>कुल खर्च: ${currency}${totalGroupExpense.toFixed(2)}</strong><br><br>`;
    activeGroup.members.forEach(m => {
        const bal = balances[m];
        if (bal > 0) settlementHtml += `<div style="color:#28a745;">🟢 <strong>${m}</strong> को <strong>${currency}${bal.toFixed(2)}</strong> मिलने हैं</div>`;
        else if (bal < 0) settlementHtml += `<div style="color:#dc3545;">🔴 <strong>${m}</strong> को <strong>${currency}${Math.abs(bal).toFixed(2)}</strong> देने हैं</div>`;
        else settlementHtml += `<div>⚪ <strong>${m}</strong> का हिसाब बराबर</div>`;
    });

    reportDiv.innerHTML = groupListHtml + settlementHtml;
}

function generateCSV() {
    if (expenses.length === 0) return showToast('warning', 'कोई डेटा नहीं है!');
    let csv = 'विवरण,राशि,दिनांक,कैटेगरी\n';
    expenses.forEach(e => csv += `"${e.desc}",${e.amount},"${e.date}","${e.category}"\n`);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'Personal_Expense_Report.csv';
    a.click();
    showToast('success', 'CSV डाउनलोड हो गया!');
}

function generatePDF() {
    if (expenses.length === 0) return showToast('warning', 'कोई डेटा नहीं है!');
    const { jsPDF } = window.jspdf || {};
    if (jsPDF) {
        const doc = new jsPDF();
        doc.text("ProCash Manager Personal Expense Report", 10, 10);
        let y = 20;
        expenses.forEach((e, i) => {
            doc.text(`${i+1}. ${e.desc} - Rs.${e.amount} (${e.category})`, 10, y);
            y += 10;
        });
        doc.save("Personal_Expense_Report.pdf");
        showToast('success', 'PDF डाउनलोड हो गया!');
    }
}

function generateGroupPDF() {
    if (!activeGroup || activeGroup.expenses.length === 0) return showToast('warning', 'कोई खर्च नहीं है!');
    const { jsPDF } = window.jspdf || {};
    if (jsPDF) {
        const doc = new jsPDF();
        const currency = document.getElementById('currencySymbol') ? document.getElementById('currencySymbol').value : '₹';
        doc.setFontSize(16);
        doc.text(`ProCash Manager - Group: ${activeGroup.name}`, 10, 12);
        let y = 25;

        activeGroup.expenses.forEach((e, i) => {
            doc.text(`${i + 1}. ${e.desc} - ${currency}${e.amount} (${e.paidBy})`, 10, y);
            y += 8;
        });

        doc.save(`${activeGroup.name}_Group_Report.pdf`);
        showToast('success', 'ग्रुप PDF डाउनलोड हो गया!');
    }
}
