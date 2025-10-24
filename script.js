// 페이지 로드가 완료되면 초기 데이터 로드 실행
document.addEventListener('DOMContentLoaded', () => {
    loadRecords();
});

// '기록하기' 버튼에 클릭 이벤트 연결
document.getElementById('record-button').addEventListener('click', addRecord);

const PASSWORD = 'stock123!'; // 설정한 비밀번호
const STORAGE_KEY = 'coinProfitLog'; // 브라우저에 데이터를 저장할 때 사용할 키
let lineChart = null; // 차트 객체를 저장할 변수

/**
 * 데이터를 브라우저(localStorage)에서 불러옵니다.
 */
function getStoredRecords() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : []; // 데이터가 없으면 빈 배열 반환
}

/**
 * 데이터를 브라우저(localStorage)에 저장합니다.
 */
function saveRecords(records) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/**
 * '기록하기' 버튼을 눌렀을 때 실행되는 함수
 */
function addRecord() {
    // 1. 비밀번호 확인
    const inputPassword = prompt('기록을 위해 암호를 입력하세요:');
    
    if (inputPassword === null) return; // 사용자가 '취소'를 누른 경우

    if (inputPassword !== PASSWORD) {
        alert('암호가 틀렸습니다!');
        return;
    }

    // 2. 비밀번호 통과 시 데이터 입력 받기
    const date = prompt('날짜 (예: 2025-10-24):');
    if (!date) return; // 날짜 입력 안 하면 중단

    const profit = prompt('수익 (원):');
    const leverage = prompt('레버리지 (배):');
    const buyFee = prompt('매입수수료 (원):');
    const sellFee = prompt('매도수수료 (원):');
    const cumulativeAsset = prompt('누적자산 (원):');
    const notes = prompt('비고:');

    // 3. 새 기록 객체 생성
    const newRecord = {
        date: date,
        profit: profit || '0', // 입력 안 하면 0
        leverage: leverage || '1', // 입력 안 하면 1
        buyFee: buyFee || '0',
        sellFee: sellFee || '0',
        cumulativeAsset: cumulativeAsset || '0',
        notes: notes || '-' // 입력 안 하면 -
    };

    // 4. 기존 데이터에 새 기록 추가
    const records = getStoredRecords();
    records.push(newRecord);
    
    // 5. 저장
    saveRecords(records);

    // 6. 화면 새로고침
    loadRecords();
}

/**
 * 저장된 데이터를 기반으로 테이블과 차트를 다시 그립니다.
 */
function loadRecords() {
    const records = getStoredRecords();
    renderTable(records);
    renderChart(records);
}

/**
 * 테이블(tbody)을 그리는 함수
 */
function renderTable(records) {
    const tableBody = document.getElementById('data-table-body');
    tableBody.innerHTML = ''; // 기존 내용 초기화

    records.forEach(record => {
        const row = tableBody.insertRow(); // 새 <tr> 생성
        
        // 각 셀(<td>)에 데이터 채우기
        row.insertCell(0).textContent = record.date;
        row.insertCell(1).textContent = record.profit;
        row.insertCell(2).textContent = record.leverage;
        row.insertCell(3).textContent = record.buyFee;
        row.insertCell(4).textContent = record.sellFee;
        row.insertCell(5).textContent = record.cumulativeAsset;
        row.insertCell(6).textContent = record.notes;
    });
}

/**
 * 누적자산 그래프를 그리는 함수
 */
function renderChart(records) {
    const ctx = document.getElementById('asset-chart').getContext('2d');

    // 그래프를 그리기 전에 날짜순으로 정렬
    const sortedRecords = records.sort((a, b) => new Date(a.date) - new Date(b.date));

    // 차트 데이터 추출
    const labels = sortedRecords.map(r => r.date); // X축 (날짜)
    const data = sortedRecords.map(r => parseFloat(r.cumulativeAsset)); // Y축 (누적자산)

    // 만약 기존 차트가 있다면 파괴(destroy)
    if (lineChart) {
        lineChart.destroy();
    }

    // 새 라인 차트 생성
    lineChart = new Chart(ctx, {
        type: 'line', // 차트 종류: 라인
        data: {
            labels: labels, // X축 레이블
            datasets: [{
                label: '누적자산 (원)',
                data: data, // Y축 데이터
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                borderWidth: 2,
                fill: true, // 라인 아래 영역 채우기
                tension: 0.1 // 라인 부드럽게
            }]
        },
        options: {
            responsive: true, // 반응형
            scales: {
                x: {
                    title: {
                        display: true,
                        text: '날짜'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: '누적자산 (원)'
                    },
                    beginAtZero: false // Y축이 0부터 시작하지 않아도 됨
                }
            },
            plugins: {
                tooltip: {
                    // 마우스 올렸을 때 툴팁 포맷
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                // 숫자를 콤마(,)로 포맷팅
                                label += new Intl.NumberFormat('ko-KR').format(context.parsed.y) + ' 원';
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}