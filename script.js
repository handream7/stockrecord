// =================================================================
// 1. Firebase v12.4.0 (v9+) 모듈 임포트
// =================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-analytics.js";
import { 
    getFirestore, 
    collection, 
    doc,        
    setDoc,     
    onSnapshot, 
    query, 
    orderBy 
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

// Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyDQudiYEJaDjCoDOVnEL3Z8NH9q6ZCmWKE",
  authDomain: "stock-6ab0b.firebaseapp.com",
  projectId: "stock-6ab0b",
  storageBucket: "stock-6ab0b.firebasestorage.app",
  messagingSenderId: "228924744899",
  appId: "1:228924744899:web:53b10e9be1c60b9a5b2e76",
  measurementId: "G-EF6X528MRP"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const logCollectionRef = collection(db, "logs"); 

// =================================================================
// 2. 전역 변수 및 DOM 요소
// =================================================================
const PASSWORD = 'stock123!';
const REMEMBER_KEY = 'stockLogPasswordRemembered';
let lineChart = null;
let currentRecords = []; 
let isModifying = false; 
let passwordCallback = null; 

const modal = document.getElementById('password-modal');
const recordButton = document.getElementById('record-button');
const modifyButton = document.getElementById('modify-button'); 
const submitPasswordBtn = document.getElementById('submit-password');
const cancelPasswordBtn = document.getElementById('cancel-password');
const passwordInput = document.getElementById('password-input');
const rememberMeCheckbox = document.getElementById('remember-me');
const tableBody = document.getElementById('data-table-body');
const saveNewButton = document.getElementById('save-new-button'); 
const saveModifyButton = document.getElementById('save-modify-button'); 

// =================================================================
// 3. 헬퍼 함수
// =================================================================

function getTodayDateString() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function setupContentEditable(cell, value, placeholder, listener = null, isLeverageCell = false) {
    cell.contentEditable = true;
    
    const initialValue = (value !== null && value !== undefined && value !== '') ? value : placeholder;
    cell.textContent = initialValue;
    cell.style.color = (initialValue !== placeholder || placeholder === '') ? '#333' : '#888';

    if (isLeverageCell && cell.textContent !== placeholder) {
        cell.textContent = 'x' + cell.textContent.replace('x', '');
    }

    cell.onfocus = () => {
        cell.style.color = '#333';
        if (cell.textContent === placeholder) {
            cell.textContent = '';
        } else if (isLeverageCell) {
            cell.textContent = cell.textContent.replace('x', '');
        }
    };

    cell.onblur = () => {
        let text = cell.textContent.trim();
        if (text === '') {
            cell.textContent = placeholder;
            if (placeholder !== '') {
                cell.style.color = '#888';
            }
        } else if (isLeverageCell) {
            text = text.replace('x', ''); 
            if (!isNaN(parseFloat(text)) && text !== '') {
                cell.textContent = 'x' + text;
            } else {
                cell.textContent = placeholder;
                if (placeholder !== '') {
                    cell.style.color = '#888';
                }
            }
        }
    };
    
    if (listener) {
        cell.addEventListener('input', () => listener(cell.parentElement));
    }
}


function updateRowPL(row) {
    if (!row) return;

    const plCell = row.cells[1];        
    const assetCell = row.cells[3];     
    
    if (!assetCell) return;

    const currentAsset = parseFloat(
        assetCell.contentEditable === 'true' ? assetCell.textContent : row.dataset.asset
    ) || 0;

    const nextRow = row.nextElementSibling; 
    let prevAsset = 0;
    if (nextRow) {
        const prevAssetCell = nextRow.cells[3];
        prevAsset = parseFloat(
            prevAssetCell.contentEditable === 'true' ? prevAssetCell.textContent : nextRow.dataset.asset
        ) || 0;
    }

    const profit = currentAsset - prevAsset;

    if (profit > 0) {
        plCell.textContent = "+" + profit.toFixed(2);
    } else {
        plCell.textContent = profit.toFixed(2);
    }
    plCell.classList.toggle('pl-positive', profit > 0);
    plCell.classList.toggle('pl-negative', profit < 0);
}


function updateProfitLossAndFollowing(row) {
    updateRowPL(row);
    const rowAbove = row.previousElementSibling;
    if (rowAbove) {
        updateRowPL(rowAbove);
    }
}


// =================================================================
// 4. 이벤트 리스너
// =================================================================

recordButton.addEventListener('click', () => {
    if (isModifying) {
        alert("먼저 '수정 저장'을 완료해주세요.");
        return;
    }
    passwordCallback = createEditableRow;
    if (localStorage.getItem(REMEMBER_KEY) === 'true') {
        passwordCallback();
    } else {
        passwordInput.value = '';
        modal.style.display = 'block';
        passwordInput.focus();
    }
});

modifyButton.addEventListener('click', () => {
    if (document.querySelector('.editable-row')) {
        alert("먼저 '저장' 버튼을 눌러 새 기록을 저장해주세요.");
        return;
    }
    passwordCallback = enableModificationMode;
    if (localStorage.getItem(REMEMBER_KEY) === 'true') {
        passwordCallback();
    } else {
        passwordInput.value = '';
        modal.style.display = 'block';
        passwordInput.focus();
    }
});


cancelPasswordBtn.addEventListener('click', () => {
    modal.style.display = 'none';
    passwordCallback = null; 
});
submitPasswordBtn.addEventListener('click', checkPassword);
passwordInput.addEventListener('keyup', (event) => {
    if (event.key === 'Enter') checkPassword();
});

saveNewButton.addEventListener('click', saveEditableRow);
saveModifyButton.addEventListener('click', saveModifications); 

// =================================================================
// 5. Firebase 데이터 실시간 감지
// =================================================================
const q = query(logCollectionRef, orderBy("date"));
onSnapshot(q, (querySnapshot) => {
    currentRecords = []; 
    querySnapshot.forEach((doc) => {
        currentRecords.push({ id: doc.id, ...doc.data() });
    });
    
    if (!isModifying) {
        renderTable(currentRecords);
    }
    renderChart(currentRecords); 

}, (error) => {
    console.error("데이터 불러오기 실패: ", error);
});

// =================================================================
// 6. 핵심 기능 함수
// =================================================================

function checkPassword() {
    if (passwordInput.value === PASSWORD) {
        if (rememberMeCheckbox.checked) {
            localStorage.setItem(REMEMBER_KEY, 'true');
        }
        modal.style.display = 'none';
        if (typeof passwordCallback === 'function') {
            passwordCallback();
        }
        passwordCallback = null; 
    } else {
        alert('암호가 틀렸습니다!');
        passwordInput.focus();
    }
}

/**
 * '기록하기' (신규 행 생성) - updateRowPL 순서 변경
 */
function createEditableRow() {
    if (document.querySelector('.editable-row')) {
        alert("이미 편집 중인 행이 있습니다.");
        return;
    }

    const row = tableBody.insertRow(0); 
    row.classList.add('editable-row'); 

    // 1. 날짜 셀 (index 0)
    const dateCell = row.insertCell(0);
    dateCell.classList.add('date-cell');
    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.value = getTodayDateString(); 
    dateCell.appendChild(dateInput);

    // 2. 손익 셀 (index 1) - 표시 전용
    const profitCell = row.insertCell(1);
    profitCell.textContent = '0.00'; 

    // 3. 레버리지 셀 (index 2)
    setupContentEditable(row.insertCell(2), null, '레버리지', null, true);

    // 4. 누적자산 셀 (index 3)
    setupContentEditable(row.insertCell(3), null, '누적자산', updateProfitLossAndFollowing, false); 

    // 5. 비고 셀 (index 4)
    setupContentEditable(row.insertCell(4), null, '', null, false); // placeholder: ''

    // (수정) 모든 셀이 생성된 후 손익 계산
    updateRowPL(row); 

    saveNewButton.style.display = 'inline-block'; 
    row.cells[2].focus(); 
}

/**
 * '저장' (신규 행 저장)
 */
async function saveEditableRow() {
    const row = document.querySelector('.editable-row');
    if (!row) return;

    const cells = row.cells;
    const assetValue = parseFloat(cells[3].textContent) || 0; 

    if (assetValue === 0 || cells[3].textContent === '누적자산') {
        alert('누적자산은 필수 입력 항목입니다.');
        return;
    }

    const newRecord = {
        date: cells[0].querySelector('input[type="date"]').value,
        profit: cells[1].textContent, 
        leverage: cells[2].textContent.replace('x', ''), 
        cumulativeAsset: assetValue,
        notes: cells[4].textContent, 
    };

    try {
        const docId = `${newRecord.date}_${Date.now()}`;
        const docRef = doc(db, "logs", docId);
        await setDoc(docRef, newRecord);

        saveNewButton.style.display = 'none'; 
    } catch (error) {
        console.error("데이터 추가 실패: ", error);
        alert("데이터 저장 중 오류가 발생했습니다.");
    }
}

/**
 * '수정하기' (기존 행 편집 모드)
 */
function enableModificationMode() {
    isModifying = true;
    saveModifyButton.style.display = 'inline-block';
    renderTable(currentRecords); 
}

/**
 * '수정 저장' (모든 수정사항 저장)
 */
async function saveModifications() {
    const rows = tableBody.rows;
    if (rows.length === 0) {
        isModifying = false;
        saveModifyButton.style.display = 'none';
        return;
    }
    
    const savePromises = []; 

    for (const row of rows) {
        const docId = row.dataset.docId;
        if (!docId) continue; 

        const cells = row.cells;
        const assetValue = parseFloat(cells[3].textContent) || 0;

        const updatedRecord = {
            date: cells[0].querySelector('input[type="date"]').value,
            profit: cells[1].textContent, 
            leverage: cells[2].textContent.replace('x', ''), 
            cumulativeAsset: assetValue,
            notes: cells[4].textContent,
        };
        
        const docRef = doc(db, "logs", docId);
        savePromises.push(setDoc(docRef, updatedRecord));
    }

    try {
        await Promise.all(savePromises); 
        alert('수정이 완료되었습니다.');
    } catch (error) {
        console.error("수정 중 오류 발생: ", error);
        alert("수정 사항을 저장하는 중 오류가 발생했습니다.");
    } finally {
        isModifying = false;
        saveModifyButton.style.display = 'none';
        renderTable(currentRecords);
    }
}


/**
 * 테이블(tbody)을 그리는 함수
 */
function renderTable(records) {
    const reversedRecords = [...records].reverse();
    
    tableBody.innerHTML = ''; 
    tableBody.classList.toggle('is-modifying', isModifying);

    reversedRecords.forEach((record, index) => {
        const row = tableBody.insertRow();
        row.dataset.docId = record.id;
        row.dataset.asset = record.cumulativeAsset; 

        const prevRecord = records[records.length - 1 - index - 1]; 
        const prevAsset = prevRecord ? prevRecord.cumulativeAsset : 0;
        const profit = record.cumulativeAsset - prevAsset;

        if (isModifying) {
            // === 수정 모드 ===
            const dateCell = row.insertCell(0);
            dateCell.classList.add('date-cell');
            const dateInput = document.createElement('input');
            dateInput.type = 'date';
            dateInput.value = record.date; 
            dateCell.appendChild(dateInput);

            const profitCell = row.insertCell(1);
            if (profit > 0) {
                profitCell.textContent = "+" + profit.toFixed(2);
            } else {
                profitCell.textContent = profit.toFixed(2);
            }
            profitCell.classList.toggle('pl-positive', profit > 0);
            profitCell.classList.toggle('pl-negative', profit < 0);

            setupContentEditable(row.insertCell(2), record.leverage, '레버리지', null, true);
            setupContentEditable(row.insertCell(3), record.cumulativeAsset, '누적자산', updateProfitLossAndFollowing, false); 
            setupContentEditable(row.insertCell(4), record.notes, '', null, false); // placeholder: ''

        } else {
            // === 일반 모드 ===
            row.insertCell(0).textContent = record.date;
            
            const profitCell = row.insertCell(1);
            if (profit > 0) {
                profitCell.textContent = "+" + profit.toFixed(2);
            } else {
                profitCell.textContent = profit.toFixed(2);
            }
            profitCell.classList.toggle('pl-positive', profit > 0);
            profitCell.classList.toggle('pl-negative', profit < 0);
            
            row.insertCell(2).textContent = 'x' + record.leverage;
            row.insertCell(3).textContent = record.cumulativeAsset;
            row.insertCell(4).textContent = record.notes || '';
        }
    });
}

/**
 * 누적자산 그래프를 그리는 함수
 */
function renderChart(records) {
    const ctx = document.getElementById('asset-chart').getContext('2d');

    const labels = records.map(r => r.date); 
    const data = records.map(r => r.cumulativeAsset); 

    if (lineChart) {
        lineChart.destroy();
    }

    lineChart = new Chart(ctx, {
        type: 'line', 
        data: {
            labels: labels,
            datasets: [{
                label: '누적자산 (달러)',
                data: data, 
                // === (수정된 부분: 핑크 계열 색상) ===
                borderColor: '#FF6F91', // 진한 핑크
                backgroundColor: 'rgba(255, 111, 145, 0.2)', // 연한 핑크 (채우기)
                // === (수정 끝) ===
                borderWidth: 2,
                fill: true,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    title: { display: true, text: '날짜' }
                },
                y: {
                    title: { display: true, text: '누적자산 (달러)' },
                    beginAtZero: false 
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': $';
                            }
                            if (context.parsed.y !== null) {
                                const value = context.parsed.y;
                                const formattedValue = new Intl.NumberFormat('en-US').format(value);
                                label += formattedValue; 
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}