// LocalStorage based unique UID generation to prevent "Loading..." loop on Vercel serverless
function getOrGenerateUID() {
    let storedUid = localStorage.getItem('bybit_user_uid');
    if (!storedUid) {
        storedUid = 'UID-' + Math.floor(100000 + Math.random() * 900000);
        localStorage.setItem('bybit_user_uid', storedUid);
    }
    return storedUid;
}

document.addEventListener('DOMContentLoaded', async () => {
    const uid = getOrGenerateUID();
    
    // UI par turant UID show kar dein taake loading khatam ho jaye
    const uidElement = document.getElementById('user-uid-display') || document.querySelector('.uid-display');
    if (uidElement) {
        uidElement.innerText = uid;
    }

    try {
        const response = await fetch(`/api/user/${uid}`);
        if (response.ok) {
            const user = await response.json();
            
            // Balance aur baaki details update karein agar backend se data mil jaye
            const balanceElement = document.getElementById('user-balance');
            if (balanceElement && user.balance !== undefined) {
                balanceElement.innerText = `$${user.balance.toFixed(2)}`;
            }
        }
    } catch (error) {
        console.log('Backend sync offline, using local fallback state.');
    }
});
