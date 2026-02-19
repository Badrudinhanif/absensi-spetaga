// ==========================================
// 1. KONFIGURASI & INITIALISASI
// ==========================================
const URL_DB = 'https://cfwfpxzukvbbkpwcklxs.supabase.co';
const KEY_DB = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmd2ZweHp1a3ZiYmtwd2NrbHhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MjY0NDIsImV4cCI6MjA4NzAwMjQ0Mn0.8oRBBBMHAJ4u3g9yU0aGmhvHGpiCr8_4-ZkFm4jbZ4U';
const sp = supabase.createClient(URL_DB, KEY_DB);

let activeUser = null;

const ui = {
    btnLoading: (status, originalText) => {
        const btn = document.querySelector('.btn-login');
        if (btn) {
            btn.disabled = status;
            btn.innerText = status ? "Memverifikasi..." : originalText;
        }
    },
    success: (m) => Swal.fire({ icon: 'success', title: 'Berhasil', text: m, timer: 1500, showConfirmButton: false }),
    errorGeneral: (m) => Swal.fire({ icon: 'error', title: 'Gagal', text: m, confirmButtonColor: '#007b5e' }),
    confirm: (t, txt, cb) => {
        Swal.fire({ title: t, text: txt, icon: 'warning', showCancelButton: true, confirmButtonColor: '#007b5e', confirmButtonText: 'Lanjutkan' }).then(r => { if(r.isConfirmed) cb(); });
    }
};

async function getBase64Image(url) {
    return new Promise((resolve) => {
        const img = new Image(); img.crossOrigin = 'Anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
            const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0); resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(null); img.src = url;
    });
}

document.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
        const loginLayer = document.getElementById('login-layer');
        if (loginLayer && loginLayer.style.display !== 'none') doLogin();
    }
});

// ==========================================
// 2. AUTHENTICATION (LOGIN & LOGOUT)
// ==========================================
function showLoginError(msg) {
    const errBox = document.getElementById('login-error');
    if (errBox) { errBox.innerText = msg; errBox.style.display = 'block'; }
}
function hideLoginError() {
    const errBox = document.getElementById('login-error');
    if (errBox) errBox.style.display = 'none';
}

async function doLogin() {
    const u = document.getElementById('user-in').value.trim().toLowerCase();
    const p = document.getElementById('pass-in').value;
    
    hideLoginError();
    if(!u || !p) return showLoginError("Username dan Password wajib diisi!");

    ui.btnLoading(true, "MASUK");
    const secretEmail = `${u}@spetaga.com`;
    
    try {
        const { data: authData, error: authErr } = await sp.auth.signInWithPassword({ email: secretEmail, password: p });
        if (authErr) throw new Error("Akses Ditolak! Username atau password salah.");

        const { data: userData, error: userErr } = await sp.from('users').select('*').eq('username', u).maybeSingle();
        ui.btnLoading(false, "MASUK");

        if (userData) {
            activeUser = userData;
            document.getElementById('login-layer').style.display = 'none';
            document.getElementById('app-shell').style.display = 'block';
            
            const r = userData.role.toLowerCase();
            document.querySelectorAll('.admin-only').forEach(e => e.style.display = r === 'admin' ? 'flex' : 'none');
            document.querySelectorAll('.guru-only').forEach(e => e.style.display = r === 'guru' ? 'flex' : 'none');
            
            ui.success(`Halo, ${userData.username}!`);
            r === 'admin' ? openPage('dash') : (setupMapelGuru(userData.mapel), openPage('absen'));
        } else {
            showLoginError("Data profil pengguna tidak ditemukan di tabel users.");
        }
    } catch(e) { 
        ui.btnLoading(false, "MASUK");
        showLoginError(e.message || "Gagal terhubung ke database. Periksa koneksi."); 
    }
}

async function doLogout() { await sp.auth.signOut(); location.reload(); }
document.querySelector('.btn-logout').onclick = doLogout;

function openPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const target = document.getElementById('pg-'+id);
    if(target) target.classList.add('active');
    document.getElementById('n-'+id)?.classList.add('active');
    window.scrollTo(0,0);
    if(id==='dash') viewRekap();
    if(id==='siswa') viewSiswa();
    if(id==='user') viewUser();
}

function setupMapelGuru(s) {
    const sel = document.getElementById('mapel-select');
    if (!sel) return; sel.innerHTML = "";
    (s ? s.split(',') : ["Umum"]).forEach(m => { sel.innerHTML += `<option value="${m.trim()}">${m.trim()}</option>`; });
}

// ==========================================
// 3. ABSENSI
// ==========================================
async function loadSiswaAbsen() {
    const kls = document.getElementById('sel-kls').value; const mpl = document.getElementById('mapel-select').value;
    if(!kls || !mpl) return;
    const tgl = new Date().toLocaleDateString('en-CA');
    const { data: ex } = await sp.from('absensi').select('id').eq('kelas',kls).eq('mapel',mpl).eq('tanggal',tgl).limit(1);

    if(ex?.length > 0) {
        document.getElementById('list-abs').innerHTML = `<div style="padding:40px; text-align:center; color:red; font-weight:bold;">Sesi ini sudah diabsen hari ini!</div>`;
        document.getElementById('btn-save').style.display = 'none'; return;
    }

    const { data: siswa } = await sp.from('database_siswa').select('nama').eq('kelas',kls).order('nama',{ascending:true});
    const b = document.getElementById('list-abs'); if(!b) return; b.innerHTML = "";
    siswa?.forEach((s, i) => {
        b.innerHTML += `<div class="absen-row"><strong>${s.nama}</strong><div class="radio-group" data-n="${s.nama}"><input type="radio" name="r-${i}" id="h-${i}" value="Hadir" checked><label for="h-${i}">H</label><input type="radio" name="r-${i}" id="i-${i}" value="Izin"><label for="i-${i}">I</label><input type="radio" name="r-${i}" id="s-${i}" value="Sakit"><label for="s-${i}">S</label><input type="radio" name="r-${i}" id="a-${i}" value="Alfa"><label for="a-${i}">A</label></div></div>`;
    });
    document.getElementById('btn-save').style.display = siswa?.length ? 'block' : 'none';
}

async function saveAbsen() {
    const kls = document.getElementById('sel-kls').value; const mpl = document.getElementById('mapel-select').value;
    const tgl = new Date().toLocaleDateString('en-CA');
    const logs = Array.from(document.querySelectorAll('.radio-group')).map(g => ({ nama: g.dataset.n, kelas: kls, mapel: mpl, tanggal: tgl, status: g.querySelector('input:checked').value, guru: activeUser.username }));
    ui.confirm("Simpan Absensi?", "Data akan dikunci untuk hari ini.", async () => {
        const { error } = await sp.from('absensi').insert(logs);
        if(!error) { ui.success("Berhasil!"); openPage('dash'); } else ui.errorGeneral(error.message);
    });
}

// ==========================================
// 4. DASHBOARD
// ==========================================
async function viewRekap() {
    const kls = document.getElementById('dash-f-kelas').value; const t1 = document.getElementById('dash-f-tgl-mulai').value;
    const t2 = document.getElementById('dash-f-tgl-akhir').value; const nma = document.getElementById('dash-f-nama').value;

    let q = sp.from('absensi').select('*').order('created_at', {ascending: false});
    if (activeUser && activeUser.role.toLowerCase() === 'guru') q = q.eq('guru', activeUser.username);
    if(kls) q = q.eq('kelas', kls); if(nma) q = q.eq('nama', nma); if(t1) q = q.gte('tanggal', t1); if(t2) q = q.lte('tanggal', t2);

    const { data } = await q.limit(100);
    const st = { 'Hadir':0, 'Izin':0, 'Sakit':0, 'Alfa':0 }; data?.forEach(r => st[r.status]++);
    
    if (document.getElementById('stat-h')) {
        document.getElementById('stat-h').innerText = st['Hadir']; document.getElementById('stat-i').innerText = st['Izin'];
        document.getElementById('stat-s').innerText = st['Sakit']; document.getElementById('stat-a').innerText = st['Alfa'];
    }

    let h = `<table><thead><tr><th>Siswa</th><th>Status</th><th>Waktu</th><th>Aksi</th></tr></thead><tbody>`;
    data?.forEach(r => {
        const jam = new Date(r.created_at).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'});
        const btn = activeUser.role.toLowerCase() === 'guru' ? `<button onclick="popEdit('${r.id}','${r.nama}','${r.status}')" style="background:orange; color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer">Edit</button>` : '-';
        h += `<tr><td><strong>${r.nama}</strong><br><small>${r.kelas} | ${r.mapel}</small></td><td><b>${r.status}</b></td><td><small>${r.tanggal}<br>${jam} WIB</small></td><td>${btn}</td></tr>`;
    });
    document.getElementById('rekap-view').innerHTML = h + "</tbody></table>";
}

async function popEdit(id, n, s) {
    const { value: b } = await Swal.fire({
        title: `Edit Status: ${n}`,
        html: `<div class="swal-radio-group" style="justify-content:center; margin-top:10px;"><input type="radio" name="sw-st" id="s-h" value="Hadir" ${s==='Hadir'?'checked':''}><label for="s-h">H</label><input type="radio" name="sw-st" id="s-i" value="Izin" ${s==='Izin'?'checked':''}><label for="s-i">I</label><input type="radio" name="sw-st" id="s-s" value="Sakit" ${s==='Sakit'?'checked':''}><label for="s-s">S</label><input type="radio" name="sw-st" id="s-a" value="Alfa" ${s==='Alfa'?'checked':''}><label for="s-a">A</label></div>`,
        showCancelButton: true, preConfirm: () => document.querySelector('input[name="sw-st"]:checked').value
    });
    if(b && b !== s) { await sp.from('absensi').update({ status: b }).eq('id', id); viewRekap(); }
}

// ==========================================
// 5. ADMIN TOOLS (CETAK & MASTER)
// ==========================================
async function updateModalCetakSiswa() {
    const kls = document.getElementById('p-kls').value; const sel = document.getElementById('p-nama');
    if (!sel) return; sel.innerHTML = '<option value="">Semua Siswa</option>'; if(!kls) return;
    const { data } = await sp.from('database_siswa').select('nama').eq('kelas', kls).order('nama',{ascending:true});
    data?.forEach(s => { sel.innerHTML += `<option value="${s.nama}">${s.nama}</option>`; });
}

async function showCetakModal() {
    const { value: f } = await Swal.fire({
        title: 'Laporan PDF',
        html: `<div style="text-align:left; display:flex; flex-direction:column; gap:12px; margin-top:15px;"><div><label style="font-weight:bold; font-size:0.9rem; color:#334155;">Kelas:</label><select id="p-kls" class="swal2-input" onchange="updateModalCetakSiswa()" style="width:100%; height:45px; margin:5px 0 0 0;"><option value="">Semua Kelas</option><option value="7">7</option><option value="8">8</option><option value="9">9</option></select></div><div><label style="font-weight:bold; font-size:0.9rem; color:#334155;">Siswa (Opsional):</label><select id="p-nama" class="swal2-input" style="width:100%; height:45px; margin:5px 0 0 0;"><option value="">Semua Siswa</option></select></div><div style="display:flex; gap:10px;"><div style="flex:1"><label style="font-weight:bold; font-size:0.9rem; color:#334155;">Dari Tanggal:</label><input type="date" id="p-t1" class="swal2-input" style="width:100%; height:45px; margin:5px 0 0 0;"></div><div style="flex:1"><label style="font-weight:bold; font-size:0.9rem; color:#334155;">Sampai Tanggal:</label><input type="date" id="p-t2" class="swal2-input" style="width:100%; height:45px; margin:5px 0 0 0;"></div></div></div>`,
        showCancelButton: true, confirmButtonColor: '#007b5e', confirmButtonText: 'Cetak PDF',
        preConfirm: () => ({ k: document.getElementById('p-kls').value, n: document.getElementById('p-nama').value, t1: document.getElementById('p-t1').value, t2: document.getElementById('p-t2').value })
    });

    if(f) {
        Swal.fire({ title: 'Menyiapkan PDF...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
        let q = sp.from('absensi').select('*');
        if(f.k) q = q.eq('kelas', f.k); if(f.n) q = q.eq('nama', f.n); if(f.t1) q = q.gte('tanggal', f.t1); if(f.t2) q = q.lte('tanggal', f.t2);
        const { data } = await q.order('tanggal', {ascending:true});
        if(!data?.length) { Swal.close(); return ui.errorGeneral("Data kosong."); }

        const rekapHitung = {};
        data.forEach(r => {
            if (!rekapHitung[r.nama]) rekapHitung[r.nama] = { H: 0, I: 0, S: 0, A: 0, Kelas: r.kelas };
            if (r.status === 'Hadir') rekapHitung[r.nama].H++; else if (r.status === 'Izin') rekapHitung[r.nama].I++; else if (r.status === 'Sakit') rekapHitung[r.nama].S++; else if (r.status === 'Alfa') rekapHitung[r.nama].A++;
        });
        const dataRekapList = Object.keys(rekapHitung).map((nama, index) => [index + 1, nama, rekapHitung[nama].Kelas, rekapHitung[nama].H, rekapHitung[nama].I, rekapHitung[nama].S, rekapHitung[nama].A]);

        const { jsPDF } = window.jspdf; const doc = new jsPDF();
        const logoBase64 = await getBase64Image('logo.png');

        if (logoBase64) doc.addImage(logoBase64, 'PNG', 14, 10, 20, 20);
        doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.text("LAPORAN REKAPITULASI ABSENSI", 40, 18);
        doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text("SMP TAKHASSUS AL-QUR'AN 3", 40, 24);
        
        let subText = ""; if (f.k) subText += `Kelas: ${f.k}    `; if (f.t1 && f.t2) subText += `Periode: ${f.t1} s.d ${f.t2}`;
        if (subText) { doc.setFontSize(9); doc.text(subText, 14, 38); }

        doc.autoTable({ startY: subText ? 42 : 35, head: [['No', 'Nama Siswa', 'Kls', 'Hadir', 'Izin', 'Sakit', 'Alfa']], body: dataRekapList, theme: 'grid', headStyles: { fillColor: [0, 123, 94] } });

        doc.addPage();
        if (logoBase64) doc.addImage(logoBase64, 'PNG', 14, 10, 15, 15);
        doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.text("RINCIAN ABSENSI HARIAN", 35, 18);
        doc.autoTable({ startY: 30, head: [['No','Tanggal','Nama','Kls','Mapel','Status']], body: data.map((r, i) => [i+1, r.tanggal, r.nama, r.kelas, r.mapel, r.status]), theme: 'grid', headStyles: { fillColor: [0, 123, 94] } });
        
        let fileName = "Rekap_Absensi"; if (f.k) fileName += `_Kls${f.k}`; if (f.n) fileName += `_${f.n.replace(/\s+/g, '')}`;
        doc.save(`${fileName}.pdf`); Swal.close();
    }
}

async function viewSiswa() {
    const f = document.getElementById('f-kls-siswa').value;
    let q = sp.from('database_siswa').select('*').order('nama',{ascending:true}); if(f) q = q.eq('kelas', f);
    const { data } = await q;
    const tb = document.getElementById('tb-siswa'); if(!tb) return; tb.innerHTML = "";
    data?.forEach(s => { tb.innerHTML += `<tr><td>${s.nama}</td><td>${s.kelas}</td><td><button onclick="editSiswa('${s.id}','${s.nama}','${s.kelas}')" style="background:#3498db; color:white; border:none; padding:5px; border-radius:5px">✎</button> <button onclick="delSiswa('${s.id}')" style="background:#e74c3c; color:white; border:none; padding:5px; border-radius:5px">🗑</button></td></tr>`; });
}
async function addSiswa() { const n = document.getElementById('in-nama-s').value; const k = document.getElementById('in-kls-s').value; if(!n) return ui.errorGeneral("Nama Kosong!"); await sp.from('database_siswa').insert([{nama: n.toUpperCase(), kelas: k}]); document.getElementById('in-nama-s').value = ""; viewSiswa(); }
async function delSiswa(id) { ui.confirm("Hapus?","Data hilang permanen.", async () => { await sp.from('database_siswa').delete().eq('id',id); viewSiswa(); }); }
async function editSiswa(id, n, k) {
    const { value: f } = await Swal.fire({ title: 'Edit Siswa', html: `<input id="e-n" class="swal2-input" value="${n}"><select id="e-k" class="swal2-input"><option value="7" ${k==='7'?'selected':''}>7</option><option value="8" ${k==='8'?'selected':''}>8</option><option value="9" ${k==='9'?'selected':''}>9</option></select>`, preConfirm: () => [document.getElementById('e-n').value, document.getElementById('e-k').value] });
    if(f) { await sp.from('database_siswa').update({nama:f[0].toUpperCase(), kelas:f[1]}).eq('id',id); viewSiswa(); }
}

async function updateNamaFilter() {
    const kls = document.getElementById('dash-f-kelas').value; const sel = document.getElementById('dash-f-nama');
    if (!sel) return; sel.innerHTML = '<option value="">Semua Nama</option>'; if(!kls) return;
    const { data } = await sp.from('database_siswa').select('nama').eq('kelas',kls).order('nama',{ascending:true});
    data?.forEach(s => { sel.innerHTML += `<option value="${s.nama}">${s.nama}</option>`; });
}

// ==========================================
// 6. KELOLA USER (PERBAIKAN TOTAL: Anti Error 400)
// ==========================================
async function viewUser() {
    const { data } = await sp.from('users').select('*').order('username',{ascending:true});
    const tb = document.getElementById('tb-user'); if(!tb) return; tb.innerHTML = "";
    data?.forEach(u => { 
        // Triks: Membersihkan string dari karakter aneh yang bisa merusak parameter fungsi
        const safeU = (u.username || '').replace(/'/g, "\\'");
        const safeP = (u.password || '').replace(/'/g, "\\'");
        const safeM = (u.mapel || '').replace(/'/g, "\\'");
        const safeR = (u.role || '').replace(/'/g, "\\'");
        
        // Kita buang penggunaan u.id, murni menggunakan safeU (username) sebagai pelacak data
        tb.innerHTML += `<tr><td>${u.username}</td><td>${u.mapel || '-'}</td><td>${u.role}</td><td><button onclick="showUserModal('${safeU}','${safeU}','${safeP}','${safeM}','${safeR}')" style="background:var(--p); color:white; border:none; padding:5px 10px; border-radius:5px">Edit</button></td></tr>`; 
    });
}

// Parameter pertama (old_u) digunakan sebagai patokan data mana yang mau diupdate
async function showUserModal(old_u='', u='', p='', m='', r='guru') {
    const isEdit = old_u !== ''; // Jika old_u terisi, berarti ini mode Edit. Jika kosong, mode Tambah.
    
    const { value: f } = await Swal.fire({
        title: isEdit ? 'Edit User' : 'Tambah User',
        html: `<input id="u-u" class="swal2-input" placeholder="User" value="${u}">
               <input id="u-p" type="password" class="swal2-input" placeholder="Pass Baru/Lama" value="${p}">
               <input id="u-m" class="swal2-input" placeholder="Mapel" value="${m}">
               <select id="u-r" class="swal2-input"><option value="guru" ${r==='guru'?'selected':''}>Guru</option><option value="admin" ${r==='admin'?'selected':''}>Admin</option></select>`,
        preConfirm: () => ({ username: document.getElementById('u-u').value.trim().toLowerCase(), password: document.getElementById('u-p').value, mapel: document.getElementById('u-m').value, role: document.getElementById('u-r').value })
    });
    
    if(f) { 
        Swal.fire({ title: 'Menyimpan...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
        
        if (!isEdit) {
            // MODE TAMBAH
            const { error: signUpErr } = await sp.auth.signUp({ email: `${f.username}@spetaga.com`, password: f.password });
            if (signUpErr) { Swal.close(); return ui.errorGeneral("Gagal membuat kredensial keamanan: " + signUpErr.message); }
            
            const { error: insErr } = await sp.from('users').insert([f]); 
            if (insErr) { Swal.close(); return ui.errorGeneral("Gagal simpan profil: " + insErr.message); }
        } else {
            // MODE EDIT (Patokan menggunakan username, BUKAN id)
            const { error: upErr } = await sp.from('users').update(f).eq('username', old_u); 
            if (upErr) { Swal.close(); return ui.errorGeneral("Gagal Update Database: " + upErr.message); }
        }
        
        Swal.close();
        ui.success("Tersimpan!");
        viewUser(); 
    }
}