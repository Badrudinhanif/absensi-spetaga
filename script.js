// ==========================================
// 1. KONFIGURASI & INITIALISASI
// ==========================================
const URL_DB = 'https://cfwfpxzukvbbkpwcklxs.supabase.co';
const KEY_DB = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmd2ZweHp1a3ZiYmtwd2NrbHhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MjY0NDIsImV4cCI6MjA4NzAwMjQ0Mn0.8oRBBBMHAJ4u3g9yU0aGmhvHGpiCr8_4-ZkFm4jbZ4U';
const sp = supabase.createClient(URL_DB, KEY_DB);

let activeUser = null;
let idleTimer;
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

const ui = {
    btnLoading: (status, originalText) => { const btn = document.querySelector('.btn-login'); if (btn) { btn.disabled = status; btn.innerText = status ? "Memverifikasi..." : originalText; }},
    success: (m) => Swal.fire({ icon: 'success', title: 'Berhasil', text: m, timer: 1500, showConfirmButton: false }),
    errorGeneral: (m) => Swal.fire({ icon: 'error', title: 'Peringatan', text: m, confirmButtonColor: '#007b5e' }),
    confirm: (t, txt, cb) => { Swal.fire({ title: t, text: txt, icon: 'warning', showCancelButton: true, confirmButtonColor: '#007b5e', confirmButtonText: 'Lanjutkan' }).then(r => { if(r.isConfirmed) cb(); }); }
};

const formatTgl = (tglStr) => {
    if (!tglStr) return '';
    const p = tglStr.split('-');
    return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : tglStr;
};

// SENSOR ENTER LOGIN
document.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') { 
        const loginLayer = document.getElementById('login-layer'); 
        if (loginLayer && loginLayer.style.display !== 'none') doLogin(); 
    }
});

// UX: TOGGLE SHOW PASSWORD
function togglePass() {
    const pwdInput = document.getElementById('pass-in');
    const icon = document.getElementById('toggle-icon');
    if (pwdInput.type === 'password') { pwdInput.type = 'text'; icon.innerText = '🙈'; } 
    else { pwdInput.type = 'password'; icon.innerText = '👁️'; }
}

// ==========================================
// 2. KEAMANAN & SESI (DENGAN TRY-CATCH-FINALLY)
// ==========================================
function resetIdleTimer() {
    clearTimeout(idleTimer);
    if (activeUser) {
        idleTimer = setTimeout(() => {
            sp.auth.signOut().then(() => {
                activeUser = null;
                Swal.fire({ icon: 'warning', title: 'Sesi Habis', text: 'Anda telah dikeluarkan otomatis.', confirmButtonColor: '#007b5e', allowOutsideClick: false }).then(() => location.reload());
            });
        }, IDLE_TIMEOUT_MS);
    }
}

['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'].forEach(evt => document.addEventListener(evt, resetIdleTimer));

async function cekSesiAktif() {
    const loader = document.getElementById('global-loader');
    const loginLayer = document.getElementById('login-layer');
    const appShell = document.getElementById('app-shell');
    const sideProfile = document.getElementById('sidebar-profile');
    
    try {
        const { data: { session } } = await sp.auth.getSession();
        
        if (session && session.user) {
            const u = session.user.email.replace('@spetaga.com', '');
            const { data: userData } = await sp.from('users').select('*').eq('username', u).maybeSingle();
            
            if (userData) {
                activeUser = userData;
                loginLayer.style.display = 'none';
                appShell.style.display = 'block';
                
                const r = userData.role.toLowerCase();
                const namaTampil = userData.nama_lengkap || userData.username;
                
                // Set Profil Sidebar
                const elNama = document.getElementById('profil-nama');
                const elRole = document.getElementById('profil-role');
                if(sideProfile && elNama && elRole) {
                    elNama.innerText = namaTampil;
                    elRole.innerText = r;
                    sideProfile.style.display = 'block';
                }

                document.querySelectorAll('.admin-only').forEach(e => e.style.display = r === 'admin' ? 'flex' : 'none');
                document.querySelectorAll('.guru-only').forEach(e => e.style.display = r === 'guru' ? 'flex' : 'none');
                
                const btnSos = document.querySelector('.fab-help');
                if(btnSos) btnSos.style.display = r === 'guru' ? 'flex' : 'none';
                
                resetIdleTimer();
                r === 'admin' ? openPage('dash') : (setupMapelGuru(userData.mapel), openPage('absen'));
            } else {
                await sp.auth.signOut();
                throw new Error("User profil tidak ditemukan");
            }
        } else {
            throw new Error("Tidak ada sesi aktif");
        }
    } catch (err) {
        loginLayer.style.display = 'flex';
        appShell.style.display = 'none';
        if(sideProfile) sideProfile.style.display = 'none';
    } finally {
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => { loader.style.display = 'none'; }, 500);
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const elTgl = document.getElementById('n-tgl');
    if(elTgl) elTgl.value = new Date().toLocaleDateString('en-CA');
    cekSesiAktif();
});

function showLoginError(msg) { const errBox = document.getElementById('login-error'); if (errBox) { errBox.innerText = msg; errBox.style.display = 'block'; } }
function hideLoginError() { const errBox = document.getElementById('login-error'); if (errBox) errBox.style.display = 'none'; }

async function doLogin() {
    const u = document.getElementById('user-in').value.trim().toLowerCase();
    const p = document.getElementById('pass-in').value;
    hideLoginError();
    if(!u || !p) return showLoginError("Username dan Password wajib diisi!");
    ui.btnLoading(true, "MASUK");
    try {
        const { error: authErr } = await sp.auth.signInWithPassword({ email: `${u}@spetaga.com`, password: p });
        if (authErr) throw new Error("Akses Ditolak!");
        ui.btnLoading(false, "MASUK");
        const loader = document.getElementById('global-loader');
        if(loader) { loader.style.display = 'flex'; loader.style.opacity = '1'; }
        cekSesiAktif(); 
    } catch(e) { ui.btnLoading(false, "MASUK"); showLoginError("Gagal Login. Periksa kredensial."); }
}

async function doLogout() { 
    clearTimeout(idleTimer); 
    const loader = document.getElementById('global-loader');
    if(loader) { loader.style.display = 'flex'; loader.style.opacity = '1'; }
    await sp.auth.signOut(); 
    location.reload(); 
}
document.querySelectorAll('.btn-logout').forEach(btn => btn.onclick = doLogout);

function hubungiAdmin() {
    const nomorWA = "6285800022010";
    const namaUser = activeUser ? (activeUser.nama_lengkap || activeUser.username) : "User";
    const pesanEncoded = encodeURIComponent(`Halo Admin SPETAGA, saya ${namaUser} butuh bantuan terkait penggunaan sistem aplikasi.`);
    window.open(`https://wa.me/${nomorWA}?text=${pesanEncoded}`, '_blank');
}

// ==========================================
// 3. NAVIGASI UTAMA
// ==========================================
function openPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const target = document.getElementById('pg-'+id);
    if(target) target.classList.add('active');
    document.getElementById('n-'+id)?.classList.add('active');
    window.scrollTo(0,0);
    if(id==='dash') viewRekap(); if(id==='siswa') viewSiswa(); if(id==='user') viewUser(); if(id==='nilai') updateDropdownTugas();
}

function setupMapelGuru(s) {
    const selAbsen = document.getElementById('mapel-select');
    const selDash = document.getElementById('dash-f-mapel');
    if (selAbsen) selAbsen.innerHTML = "";
    if (selDash) { selDash.style.display = 'block'; selDash.innerHTML = '<option value="">Semua Mapel Saya</option>'; }
    (s ? s.split(',') : ["Umum"]).forEach(m => { 
        if (selAbsen) selAbsen.innerHTML += `<option value="${m.trim()}">${m.trim()}</option>`; 
        if (selDash) selDash.innerHTML += `<option value="${m.trim()}">${m.trim()}</option>`;
    });
}

// ==========================================
// 4. ABSENSI
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
    const logs = Array.from(document.querySelectorAll('.radio-group')).map(g => ({ nama: g.dataset.n, kelas: kls, mapel: mpl, tanggal: new Date().toLocaleDateString('en-CA'), status: g.querySelector('input:checked').value, guru: activeUser.nama_lengkap || activeUser.username }));
    ui.confirm("Simpan Absensi?", "Data akan dikunci untuk hari ini.", async () => {
        const { error } = await sp.from('absensi').insert(logs);
        if(!error) { ui.success("Berhasil!"); openPage('dash'); } else ui.errorGeneral(error.message);
    });
}

// ==========================================
// 5. PENILAIAN AKADEMIK
// ==========================================
async function loadSiswaNilai() {
    const kls = document.getElementById('n-sel-kls').value; const jns = document.getElementById('n-sel-jenis').value;
    const ket = document.getElementById('n-ket').value.trim(); const tgl = document.getElementById('n-tgl').value;
    if(!kls || !ket || !tgl) return ui.errorGeneral("Harap lengkapi Kelas, Judul Keterangan, dan Tanggal!");
    const { data: ex } = await sp.from('nilai_siswa').select('id').eq('kelas', kls).eq('jenis_nilai', jns).eq('keterangan', ket).limit(1);
    if(ex?.length > 0) { document.getElementById('container-nilai').style.display = 'none'; return ui.errorGeneral(`Data untuk tugas "${ket}" sudah pernah disimpan.`); }
    const { data: siswa } = await sp.from('database_siswa').select('nama').eq('kelas', kls).order('nama',{ascending:true});
    const b = document.getElementById('list-nilai'); if(!b) return; 
    b.innerHTML = `<div style="padding:15px 25px; background:#f8fafc; border-bottom:2px solid #e2e8f0; font-weight:bold; color:#64748b; font-size:0.85rem; text-transform:uppercase;">Daftar Siswa - Masukkan Angka (0-100)</div>`;
    siswa?.forEach((s, i) => { b.innerHTML += `<div class="absen-row" style="padding:10px 25px;"><strong style="flex:1">${s.nama}</strong><div style="width:100px;"><input type="number" class="input-nilai-massal" data-n="${s.nama}" placeholder="0" onfocus="this.placeholder=''; if(this.value=='0') this.value='';" onblur="this.placeholder='0';" min="0" max="100" style="width:100%; text-align:center; padding:10px; border:2px solid #e2e8f0; border-radius:10px; font-weight:bold; font-size:1.1rem; color:#0f172a;"></div></div>`; });
    document.getElementById('container-nilai').style.display = siswa?.length ? 'block' : 'none';
}

async function saveNilai() {
    const kls = document.getElementById('n-sel-kls').value; const jns = document.getElementById('n-sel-jenis').value;
    const ket = document.getElementById('n-ket').value.trim(); const tgl = document.getElementById('n-tgl').value;
    const mpl = document.getElementById('mapel-select') ? document.getElementById('mapel-select').value : (activeUser.mapel || 'Umum'); 
    let logs = []; let adaKosong = false;
    document.querySelectorAll('.input-nilai-massal').forEach(inp => {
        const val = inp.value.trim(); if (val === '') adaKosong = true;
        logs.push({ tanggal: tgl, kelas: kls, mapel: mpl, jenis_nilai: jns, keterangan: ket, nama_siswa: inp.dataset.n, nilai: val === '' ? 0 : parseInt(val), guru: activeUser.nama_lengkap || activeUser.username });
    });
    if (adaKosong) ui.confirm("Ada Nilai Kosong!", "Siswa yang kosong otomatis mendapat 0. Lanjutkan?", executeSave);
    else ui.confirm("Simpan Semua Nilai?", `Merekap nilai untuk ${logs.length} siswa.`, executeSave);
    async function executeSave() {
        Swal.fire({ title: 'Menyimpan...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
        const { error } = await sp.from('nilai_siswa').insert(logs);
        Swal.close();
        if(!error) { 
            ui.success("Tersimpan!"); document.getElementById('container-nilai').style.display = 'none'; document.getElementById('n-ket').value = ''; 
            updateDropdownTugas(); document.getElementById('tb-riwayat-nilai').innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 30px;">Silakan atur filter di atas lalu klik <b>CARI</b>.</td></tr>`;
        } else ui.errorGeneral(error.message);
    }
}

async function updateDropdownTugas() {
    const kls = document.getElementById('r-sel-kls').value; const jns = document.getElementById('r-sel-jenis').value; const sel = document.getElementById('r-ket');
    if(!sel) return; sel.innerHTML = '<option value="">Semua Tugas (Memuat...)</option>';
    let q = sp.from('nilai_siswa').select('keterangan');
    if (activeUser && activeUser.role.toLowerCase() === 'guru') q = q.eq('guru', activeUser.nama_lengkap || activeUser.username);
    if(kls) q = q.eq('kelas', kls); if(jns) q = q.eq('jenis_nilai', jns);
    const { data } = await q; sel.innerHTML = '<option value="">Semua Tugas</option>';
    if(data) [...new Set(data.map(i => i.keterangan))].forEach(t => sel.innerHTML += `<option value="${t}">${t}</option>`);
}

async function loadRiwayatNilai() {
    const kls = document.getElementById('r-sel-kls').value; const jns = document.getElementById('r-sel-jenis').value;
    const ket = document.getElementById('r-ket').value; const tb = document.getElementById('tb-riwayat-nilai');
    tb.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 20px;">Menarik data dari server...</td></tr>`;
    let q = sp.from('nilai_siswa').select('*').order('created_at', {ascending: false}).limit(100);
    if (activeUser && activeUser.role.toLowerCase() === 'guru') q = q.eq('guru', activeUser.nama_lengkap || activeUser.username);
    if(kls) q = q.eq('kelas', kls); if(jns) q = q.eq('jenis_nilai', jns); if(ket) q = q.eq('keterangan', ket);
    const { data, error } = await q;
    if (error || !data || data.length === 0) { tb.innerHTML = `<tr><td colspan="4" style="text-align:center;">Tidak ada data.</td></tr>`; return; }
    tb.innerHTML = "";
    data.forEach(r => {
        tb.innerHTML += `<tr><td><strong>${r.keterangan}</strong><br><small>${r.jenis_nilai} | ${formatTgl(r.tanggal)}</small></td><td><strong>${r.nama_siswa}</strong><br><small>Kls ${r.kelas} | ${r.mapel}</small></td><td><b style="color:var(--p)">${r.nilai}</b></td><td style="display:flex; gap:5px;"><button onclick="editNilaiTunggal('${r.id}', '${r.nama_siswa}', '${r.nilai}', '${r.keterangan}')" style="background:orange; color:white; border:none; padding:6px 10px; border-radius:5px;">Edit</button><button onclick="hapusNilaiTunggal('${r.id}', '${r.nama_siswa}')" style="background:#e74c3c; color:white; border:none; padding:6px 10px; border-radius:5px;">Hapus</button></td></tr>`;
    });
}

async function editNilaiTunggal(id, nama, nilaiLama, ket) {
    const { value: nBaru } = await Swal.fire({ title: `Edit Nilai: ${nama}`, text: `Tugas: ${ket}`, input: 'number', inputValue: nilaiLama, showCancelButton: true, confirmButtonText: 'Simpan', inputValidator: (value) => { if (value === '' || value < 0 || value > 100) return 'Nilai harus 0 - 100!'; }});
    if (nBaru) { Swal.fire({ title: 'Menyimpan...', didOpen: () => Swal.showLoading() }); await sp.from('nilai_siswa').update({ nilai: parseInt(nBaru) }).eq('id', id); Swal.close(); loadRiwayatNilai(); }
}

async function hapusNilaiTunggal(id, nama) {
    ui.confirm("Hapus Nilai?", `Yakin menghapus nilai ${nama}?`, async () => { Swal.fire({ title: 'Menghapus...', didOpen: () => Swal.showLoading() }); await sp.from('nilai_siswa').delete().eq('id', id); Swal.close(); loadRiwayatNilai(); updateDropdownTugas(); });
}

// ==========================================
// 6. DASHBOARD & REKAP
// ==========================================
async function updateNamaFilter() {
    const kls = document.getElementById('dash-f-kelas').value; const sel = document.getElementById('dash-f-nama');
    if (!sel) return; sel.innerHTML = '<option value="">Semua Nama</option>'; if(!kls) return;
    const { data } = await sp.from('database_siswa').select('nama').eq('kelas',kls).order('nama');
    data?.forEach(s => sel.innerHTML += `<option value="${s.nama}">${s.nama}</option>`);
}

async function viewRekap() {
    const kls = document.getElementById('dash-f-kelas').value; const t1 = document.getElementById('dash-f-tgl-mulai').value; const t2 = document.getElementById('dash-f-tgl-akhir').value; const nma = document.getElementById('dash-f-nama').value; const mpl = document.getElementById('dash-f-mapel') ? document.getElementById('dash-f-mapel').value : "";
    let q = sp.from('absensi').select('*').order('created_at', {ascending: false});
    if (activeUser && activeUser.role.toLowerCase() === 'guru') { q = q.eq('guru', activeUser.nama_lengkap || activeUser.username); if (mpl) q = q.eq('mapel', mpl); }
    if(kls) q = q.eq('kelas', kls); if(nma) q = q.eq('nama', nma); if(t1) q = q.gte('tanggal', t1); if(t2) q = q.lte('tanggal', t2);
    const { data } = await q.limit(100);
    const st = { 'Hadir':0, 'Izin':0, 'Sakit':0, 'Alfa':0 }; data?.forEach(r => st[r.status]++);
    if (document.getElementById('stat-h')) { document.getElementById('stat-h').innerText = st['Hadir']; document.getElementById('stat-i').innerText = st['Izin']; document.getElementById('stat-s').innerText = st['Sakit']; document.getElementById('stat-a').innerText = st['Alfa']; }
    let h = `<table><thead><tr><th>Siswa</th><th>Status</th><th>Waktu</th><th>Aksi</th></tr></thead><tbody>`;
    data?.forEach(r => {
        const jam = new Date(r.created_at).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'});
        const btn = activeUser.role.toLowerCase() === 'guru' ? `<button onclick="popEdit('${r.id}','${r.nama}','${r.status}')" style="background:orange; color:white; border:none; padding:5px 10px; border-radius:5px;">Edit</button>` : '-';
        h += `<tr><td><strong>${r.nama}</strong><br><small>${r.kelas} | ${r.mapel}</small></td><td><b>${r.status}</b></td><td><small>${formatTgl(r.tanggal)}<br>${jam}</small></td><td>${btn}</td></tr>`;
    });
    document.getElementById('rekap-view').innerHTML = h + "</tbody></table>";
}

async function popEdit(id, n, s) {
    const { value: b } = await Swal.fire({ title: `Edit Status: ${n}`, html: `<div class="swal-radio-group" style="justify-content:center; margin-top:10px;"><input type="radio" name="sw-st" id="s-h" value="Hadir" ${s==='Hadir'?'checked':''}><label for="s-h">H</label><input type="radio" name="sw-st" id="s-i" value="Izin" ${s==='Izin'?'checked':''}><label for="s-i">I</label><input type="radio" name="sw-st" id="s-s" value="Sakit" ${s==='Sakit'?'checked':''}><label for="s-s">S</label><input type="radio" name="sw-st" id="s-a" value="Alfa" ${s==='Alfa'?'checked':''}><label for="s-a">A</label></div>`, showCancelButton: true, preConfirm: () => document.querySelector('input[name="sw-st"]:checked').value });
    if(b && b !== s) { await sp.from('absensi').update({ status: b }).eq('id', id); viewRekap(); }
}

// ==========================================
// 7. ADMIN TOOLS & MASTER DATA
// ==========================================
window.toggleFilterTugas = function() { const wrap = document.getElementById('wrap-p-ket'); if(wrap) wrap.style.display = (document.getElementById('p-jenis').value === 'absen') ? 'none' : 'block'; }
async function updateModalFilter() {
    const kls = document.getElementById('p-kls').value; const selNama = document.getElementById('p-nama'); const selKet = document.getElementById('p-ket');
    if (!selNama || !selKet) return; selNama.innerHTML = '<option value="">Semua Siswa</option>'; selKet.innerHTML = '<option value="">Semua Tugas</option>'; if(!kls) return;
    const { data: sData } = await sp.from('database_siswa').select('nama').eq('kelas', kls).order('nama'); 
    sData?.forEach(s => selNama.innerHTML += `<option value="${s.nama}">${s.nama}</option>`);
    let q = sp.from('nilai_siswa').select('keterangan').eq('kelas', kls);
    if (activeUser && activeUser.role.toLowerCase() === 'guru') { q = q.eq('guru', activeUser.nama_lengkap || activeUser.username); }
    const { data: tData } = await q; 
    if(tData) [...new Set(tData.map(i => i.keterangan))].forEach(t => selKet.innerHTML += `<option value="${t}">${t}</option>`);
}

async function showCetakModal() {
    const { value: f } = await Swal.fire({
        title: 'Ekspor Laporan', html: `<div style="text-align:left; display:flex; flex-direction:column; gap:12px; margin-top:15px;"><select id="p-jenis" class="swal2-input" onchange="toggleFilterTugas()"><option value="absen">Rekap Absensi (PDF)</option><option value="nilai-pdf">Rekap Nilai Mading (PDF)</option><option value="nilai-csv">Rekap Nilai (CSV)</option></select><select id="p-kls" class="swal2-input" onchange="updateModalFilter()"><option value="">Pilih Kelas</option><option value="7">7</option><option value="8">8</option><option value="9">9</option></select><select id="p-nama" class="swal2-input"><option value="">Semua Siswa</option></select><div id="wrap-p-ket" style="display:none;"><select id="p-ket" class="swal2-input"><option value="">Pilih Kelas Dahulu</option></select></div><div style="display:flex; gap:10px;"><input type="date" id="p-t1" class="swal2-input"><input type="date" id="p-t2" class="swal2-input"></div></div>`, showCancelButton: true, confirmButtonColor: '#007b5e', confirmButtonText: 'Ekspor', didOpen: () => toggleFilterTugas(), preConfirm: () => ({ j: document.getElementById('p-jenis').value, k: document.getElementById('p-kls').value, n: document.getElementById('p-nama').value, ket: document.getElementById('p-ket').value, t1: document.getElementById('p-t1').value, t2: document.getElementById('p-t2').value })
    });
    if(f) { if(f.j === 'absen') await eksporAbsensiPDF(f); else if (f.j === 'nilai-pdf') await eksporNilaiPDF(f); else if (f.j === 'nilai-csv') await eksporNilaiCSV(f); }
}

async function eksporAbsensiPDF(f) {
    if(!f.k) return ui.errorGeneral("Pilih Kelas!"); Swal.fire({ title: 'Menyiapkan...', didOpen: () => Swal.showLoading()});
    let q = sp.from('absensi').select('*'); if(f.k) q = q.eq('kelas', f.k); if(f.n) q = q.eq('nama', f.n); if(f.t1) q = q.gte('tanggal', f.t1); if(f.t2) q = q.lte('tanggal', f.t2);
    if (activeUser && activeUser.role.toLowerCase() === 'guru') { q = q.eq('guru', activeUser.nama_lengkap || activeUser.username); }
    const { data } = await q.order('tanggal').order('nama'); if(!data?.length) { Swal.close(); return ui.errorGeneral("Data kosong."); }
    const rekap = {}; data.forEach(r => { if (!rekap[r.nama]) rekap[r.nama] = { H: 0, I: 0, S: 0, A: 0, Kelas: r.kelas }; if (r.status === 'Hadir') rekap[r.nama].H++; else if (r.status === 'Izin') rekap[r.nama].I++; else if (r.status === 'Sakit') rekap[r.nama].S++; else if (r.status === 'Alfa') rekap[r.nama].A++; });
    const { jsPDF } = window.jspdf; const doc = new jsPDF();
    doc.text(`LAPORAN ABSENSI KELAS ${f.k}`, 14, 20);
    doc.autoTable({ startY: 30, head: [['No', 'Nama', 'Kls', 'H', 'I', 'S', 'A']], body: Object.keys(rekap).map((n, i) => [i + 1, n, rekap[n].Kelas, rekap[n].H, rekap[n].I, rekap[n].S, rekap[n].A]), theme: 'grid' });
    doc.save(`Absensi_Kls${f.k}.pdf`); Swal.close();
}

async function eksporNilaiPDF(f) {
    if(!f.k) return ui.errorGeneral("Pilih Kelas!"); Swal.fire({ title: 'Menyiapkan...', didOpen: () => Swal.showLoading() });
    let q = sp.from('nilai_siswa').select('*').eq('kelas', f.k); if(f.n) q = q.eq('nama_siswa', f.n); if(f.ket) q = q.eq('keterangan', f.ket); if(f.t1) q = q.gte('tanggal', f.t1); if(f.t2) q = q.lte('tanggal', f.t2);
    if (activeUser && activeUser.role.toLowerCase() === 'guru') { q = q.eq('guru', activeUser.nama_lengkap || activeUser.username); }
    const { data } = await q.order('tanggal').order('nama_siswa'); if(!data?.length) { Swal.close(); return ui.errorGeneral("Data kosong."); }
    const { jsPDF } = window.jspdf; const doc = new jsPDF();
    const groups = data.reduce((acc, curr) => { if (!acc[curr.keterangan]) acc[curr.keterangan] = []; acc[curr.keterangan].push(curr); return acc; }, {});
    Object.keys(groups).forEach((judul, idx) => {
        if (idx > 0) doc.addPage();
        doc.text(`DAFTAR NILAI - ${judul} - KELAS ${f.k}`, 14, 20);
        doc.autoTable({ startY: 30, head: [['No', 'Nama Siswa', 'Nilai']], body: groups[judul].map((r, i) => [i + 1, r.nama_siswa, r.nilai]) });
    });
    doc.save(`Nilai_Mading_Kls${f.k}.pdf`); Swal.close();
}

async function eksporNilaiCSV(f) {
    if(!f.k) return ui.errorGeneral("Pilih Kelas!"); Swal.fire({ title: 'Menyiapkan...', didOpen: () => Swal.showLoading()});
    let q = sp.from('nilai_siswa').select('*'); if(f.k) q = q.eq('kelas', f.k); if(f.n) q = q.eq('nama_siswa', f.n); if(f.ket) q = q.eq('keterangan', f.ket); if(f.t1) q = q.gte('tanggal', f.t1); if(f.t2) q = q.lte('tanggal', f.t2);
    if (activeUser && activeUser.role.toLowerCase() === 'guru') { q = q.eq('guru', activeUser.nama_lengkap || activeUser.username); }
    const { data } = await q.order('kelas').order('nama_siswa').order('tanggal'); if(!data?.length) { Swal.close(); return ui.errorGeneral("Data kosong."); }
    let csvData = "Tanggal,Kelas,Mapel,Guru,Siswa,Jenis,Tugas,Nilai\n";
    data.forEach(r => csvData += `"${r.tanggal}","${r.kelas}","${r.mapel}","${r.guru}","${r.nama_siswa}","${r.jenis_nilai}","${r.keterangan}","${r.nilai}"\n`);
    const link = document.createElement("a"); link.setAttribute("href", URL.createObjectURL(new Blob([csvData], { type: 'text/csv;charset=utf-8;' }))); link.setAttribute("download", `Nilai_Kls${f.k}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link); Swal.close();
}

// IMPORT CSV SISWA
async function prosesUploadCSV() {
    const fileInput = document.getElementById('file-csv');
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        const text = e.target.result;
        const lines = text.split(/\r?\n/);
        let dataSiswa = [];
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const cols = lines[i].split(/[,;]/);
            if (cols.length >= 2) {
                const namaBersih = cols[0].trim().replace(/['"]/g, '').toUpperCase();
                const kelasBersih = cols[1].trim().replace(/['"]/g, '');
                if(namaBersih && kelasBersih) dataSiswa.push({ nama: namaBersih, kelas: kelasBersih });
            }
        }
        if(dataSiswa.length === 0) { fileInput.value = ''; return ui.errorGeneral("Data kosong atau format salah. Pastikan file berupa CSV dengan kolom Nama dan Kelas."); }
        ui.confirm("Upload " + dataSiswa.length + " Siswa?", "Pastikan tidak ada data ganda sebelum melanjutkan.", async () => {
            Swal.fire({ title: 'Menyimpan Data...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
            const { error } = await sp.from('database_siswa').insert(dataSiswa);
            Swal.close(); fileInput.value = '';
            if (!error) { ui.success("Data berhasil diinjeksi!"); viewSiswa(); } else ui.errorGeneral(error.message);
        });
    };
    reader.readAsText(file);
}

async function viewSiswa() {
    const f = document.getElementById('f-kls-siswa').value; let q = sp.from('database_siswa').select('*').order('nama'); if(f) q = q.eq('kelas', f);
    const { data } = await q; const tb = document.getElementById('tb-siswa'); tb.innerHTML = "";
    data?.forEach(s => tb.innerHTML += `<tr><td>${s.nama}</td><td>${s.kelas}</td><td><button onclick="editSiswa('${s.id}','${s.nama}','${s.kelas}')" style="background:#3498db; color:white; border:none; padding:6px 10px; border-radius:5px; margin-right:5px; font-weight:bold; cursor:pointer;">Edit</button> <button onclick="delSiswa('${s.id}')" style="background:#e74c3c; color:white; border:none; padding:6px 10px; border-radius:5px; font-weight:bold; cursor:pointer;">Hapus</button></td></tr>`);
}
async function addSiswa() { const n = document.getElementById('in-nama-s').value; const k = document.getElementById('in-kls-s').value; if(!n) return; await sp.from('database_siswa').insert([{nama: n.toUpperCase(), kelas: k}]); document.getElementById('in-nama-s').value = ""; viewSiswa(); }
async function delSiswa(id) { ui.confirm("Hapus?","", async () => { await sp.from('database_siswa').delete().eq('id',id); viewSiswa(); }); }
async function editSiswa(id, n, k) { const { value: f } = await Swal.fire({ title: 'Edit', html: `<input id="e-n" class="swal2-input" value="${n}"><select id="e-k" class="swal2-input"><option value="7" ${k==='7'?'selected':''}>7</option><option value="8" ${k==='8'?'selected':''}>8</option><option value="9" ${k==='9'?'selected':''}>9</option></select>`, preConfirm: () => [document.getElementById('e-n').value, document.getElementById('e-k').value] }); if(f) { await sp.from('database_siswa').update({nama:f[0].toUpperCase(), kelas:f[1]}).eq('id',id); viewSiswa(); } }

async function viewUser() {
    const { data } = await sp.from('users').select('*').order('username'); const tb = document.getElementById('tb-user'); tb.innerHTML = "";
    data?.forEach(u => tb.innerHTML += `<tr><td>${u.username}</td><td>${u.nama_lengkap || '-'}</td><td>${u.mapel || '-'}</td><td>${u.role}</td><td><button onclick="showUserModal('${u.username}','${u.username}','${u.password}','${u.mapel}','${u.role}','${u.nama_lengkap}')" style="background:var(--p); color:white; border:none; padding:5px 10px; border-radius:5px">Edit</button></td></tr>`);
}
async function showUserModal(old_u='', u='', p='', m='', r='guru', nl='') {
    const isEdit = old_u !== ''; 
    const { value: f } = await Swal.fire({ title: isEdit ? 'Edit User' : 'Tambah', html: `<input id="u-nl" class="swal2-input" placeholder="Nama Lengkap" value="${nl}"><input id="u-u" class="swal2-input" placeholder="Username" value="${u}"><input id="u-p" type="password" class="swal2-input" placeholder="Password" value="${p}"><input id="u-m" class="swal2-input" placeholder="Mapel" value="${m}"><select id="u-r" class="swal2-input"><option value="guru" ${r==='guru'?'selected':''}>Guru</option><option value="admin" ${r==='admin'?'selected':''}>Admin</option></select>`, preConfirm: () => ({ nama_lengkap: document.getElementById('u-nl').value, username: document.getElementById('u-u').value.toLowerCase(), password: document.getElementById('u-p').value, mapel: document.getElementById('u-m').value, role: document.getElementById('u-r').value }) });
    if(f) { 
        Swal.fire({ title: 'Menyimpan...', didOpen: () => Swal.showLoading()});
        if (!isEdit) { await sp.auth.signUp({ email: `${f.username}@spetaga.com`, password: f.password }); await sp.from('users').insert([f]); } 
        else { await sp.from('users').update(f).eq('username', old_u); }
        Swal.close(); ui.success("Tersimpan!"); viewUser(); 
    }
}