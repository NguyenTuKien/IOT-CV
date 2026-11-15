# Che do bay cho laptop: giu laptop thuc va hotspot Wi-Fi khoe suot buoi bay ngoai bai.
#
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\laptop\che_do_bay.ps1        # xem
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\laptop\che_do_bay.ps1 -Bat   # bat
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\laptop\che_do_bay.ps1 -Tat   # tra lai
#   ... che_do_bay.ps1 -Bat -GiuQuetWifi   # bat, nhung de card Wi-Fi tu quet nhu thuong
#
# Vi sao (plans/reports/261102-phan-tich-bay-01-11.md): toi 01/11/2026 laptop NGU luc 19:45:33
# ("Sleep Reason: Button or Lid") toi 20:33 -> hotspot tat, hai ESP32 mat mang, web / tlog / video
# trong suot 48 phut bay. Truoc do Energy Saver tu bat (nguong 40% pin) lam hotspot rot ~8 s moi
# ~15 s. May con tu ngu sau 10 phut khong cham phim khi chay pin, va card Wi-Fi o scheme
# "Legion Balance Mode" de Medium Power Saving khi chay pin.
#
# -Bat ghi tren MOI power scheme (Legion tu doi Quiet / Balance / Performance khi bam Fn+Q hay rut
# sac, sua mot scheme la chua du): gap nap, nut nguon, nut sleep = khong lam gi; tu ngu = khong bao
# gio; Energy Saver = khong tu bat; card Wi-Fi = Maximum Performance. Ca cam sac lan chay pin.
# Gia tri cu luu o logs\laptop\che-do-bay-truoc.json; -Tat ghi lai dung cac gia tri do roi xoa file.
# Phan nguon dien nay khong can admin, khong dung toi driver card mang (khong lam rot mang dang dung).
#
# -Bat con tat "auto configuration" cua card Wi-Fi (netsh, CAN ADMIN: hien mot hop UAC, bam Yes).
# Du khong noi mang nao, card van tu quet ~60 s mot lan; moi lan quet radio roi kenh hotspot vai
# giay, hai ESP32 mat goi cung luc. Do 02/11/2026, internet qua cap iPhone: con quet -> 108 s co 2
# lan quet, DroneBridge mat 3 s, camera mat 8 s, camera 4,7 khung/s; tat -> 150 s khong lan quet
# nao, hai bo mat 0 goi, camera 9,2 khung/s; hotspot van chay. Doi lai: Windows KHONG tu noi Wi-Fi
# nao (ca Wi-Fi nha) toi khi -Tat. -Tat chi bat lai khi chinh che do bay da tat (ghi o
# logs\laptop\che-do-bay-wifi.json). -GiuQuetWifi: bo qua buoc nay.
#
# Gap nap khi dang o che do bay thi laptop VAN CHAY: dung cho vao balo (nong). Bay xong chay -Tat.
param([switch] $Bat, [switch] $Tat, [switch] $GiuQuetWifi)
$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$FileLuu = Join-Path $Root 'logs\laptop\che-do-bay-truoc.json'
$FileWifi = Join-Path $Root 'logs\laptop\che-do-bay-wifi.json'

# Gia tri "Bay" ap cho ca AC (cam sac) va DC (chay pin).
$CaiDat = @(
    @{ Ten = 'Gap nap';                  Sub = '4f971e89-eebd-4455-a8de-9e59040e7347'; Set = '5ca83367-6e45-459f-a27b-476b1d01c936'; Bay = 0 },
    @{ Ten = 'Nut nguon';                Sub = '4f971e89-eebd-4455-a8de-9e59040e7347'; Set = '7648efa3-dd9c-4e3e-b566-50f929386280'; Bay = 0 },
    @{ Ten = 'Nut sleep';                Sub = '4f971e89-eebd-4455-a8de-9e59040e7347'; Set = '96996bc0-ad50-47ec-923b-6f41874dd9eb'; Bay = 0 },
    @{ Ten = 'Tu ngu sau (giay)';        Sub = '238c9fa8-0aad-41ed-83f4-97be242c8f20'; Set = '29f6c1db-86da-48c5-9fdb-f2b67b1f44da'; Bay = 0 },
    @{ Ten = 'Energy Saver tu bat (%)';  Sub = 'de830923-a562-41af-a086-e3a2c6bad2da'; Set = 'e69653ca-cf7f-4f05-aa73-cb833fa90ad4'; Bay = 0 },
    @{ Ten = 'Card Wi-Fi tiet kiem dien'; Sub = '19cbb8fa-5279-450e-9fac-8a3d5fedd0c1'; Set = '12bbebe6-58d6-4636-95bb-3217ef867c1a'; Bay = 0 }
)
# Nhan de doc: nut / nap 0 = khong lam gi, 1 = ngu; Wi-Fi 0 = Maximum Performance, 2 = Medium.

function Get-Schemes {
    $guids = @(powercfg /list | Select-String '[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}' |
        ForEach-Object { $_.Matches[0].Value })
    if ($guids.Count -eq 0) { throw 'powercfg /list khong tra ve power scheme nao' }
    return $guids
}

function Get-ActiveScheme {
    $m = (powercfg /getactivescheme | Out-String) -match '([0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12})'
    if (-not $m) { throw 'Khong doc duoc power scheme dang dung' }
    return $Matches[1]
}

# (AC, DC) hien tai cua mot cai dat, $null neu scheme khong co cai dat do.
# Hai so 0x cuoi cung cua khoi la "Current AC" roi "Current DC" (khong phu thuoc ngon ngu Windows).
function Read-Value([string] $Scheme, [hashtable] $S) {
    $out = powercfg /qh $Scheme $S.Sub $S.Set 2>&1 | Out-String
    $hex = @([regex]::Matches($out, '0x([0-9a-fA-F]{8})') | ForEach-Object { [Convert]::ToInt32($_.Groups[1].Value, 16) })
    if ($LASTEXITCODE -ne 0 -or $hex.Count -lt 2) { return $null }
    return @{ Ac = $hex[$hex.Count - 2]; Dc = $hex[$hex.Count - 1] }
}

function Set-Value([string] $Scheme, [string] $Sub, [string] $Set, [int] $Ac, [int] $Dc) {
    powercfg /setacvalueindex $Scheme $Sub $Set $Ac
    if ($LASTEXITCODE -ne 0) { throw "powercfg /setacvalueindex $Scheme $Set hong" }
    powercfg /setdcvalueindex $Scheme $Sub $Set $Dc
    if ($LASTEXITCODE -ne 0) { throw "powercfg /setdcvalueindex $Scheme $Set hong" }
}

# Ten card Wi-Fi that (NdisPhysicalMedium 9 = 802.11; -Physical bo card ao Wi-Fi Direct cua hotspot).
function Get-WifiCard {
    $card = @(Get-NetAdapter -Physical -ErrorAction SilentlyContinue | Where-Object { $_.NdisPhysicalMedium -eq 9 }) |
        Select-Object -First 1
    if ($card) { return $card.Name }
    return $null
}

# $true = card dang tu quet (auto configuration bat), $false = da tat, $null = khong doc duoc.
# Doc chu netsh in ra (Windows tieng Anh); Windows ngon ngu khac thi tra $null, khong doan.
function Get-WifiTuQuet([string] $Card) {
    $out = netsh wlan show settings | Out-String
    $m = [regex]::Match($out, 'Auto configuration logic is (enabled|disabled) on interface "' + [regex]::Escape($Card) + '"')
    if (-not $m.Success) { return $null }
    return $m.Groups[1].Value -eq 'enabled'
}

# Bat / tat auto configuration bang mot tien trinh admin (hop UAC), roi doc lai.
# Tra $null khi doc lai dung y muon, hoac mot cau noi ly do hong.
function Set-WifiTuQuet([string] $Card, [bool] $Quet) {
    $v = if ($Quet) { 'yes' } else { 'no' }
    $lenh = "netsh wlan set autoconfig enabled=$v interface=`"$Card`""
    $enc = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($lenh))
    try {
        Start-Process powershell.exe -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList '-NoProfile', '-EncodedCommand', $enc
    } catch {
        return "khong chay duoc netsh voi quyen admin (hop UAC bi tu choi?): $($_.Exception.Message)"
    }
    $sau = Get-WifiTuQuet $Card
    if ($sau -ne $Quet) { return "netsh da chay nhung doc lai thay card '$Card' tu quet = $sau" }
    return $null
}

function Read-WifiFile {
    if (-not (Test-Path $FileWifi)) { return $null }
    return Get-Content -Raw -Path $FileWifi | ConvertFrom-Json
}

function Save-WifiFile([string] $Card, [bool] $DaTat, [bool] $GiuQuet) {
    New-Item -ItemType Directory -Force -Path (Split-Path $FileWifi) | Out-Null
    $o = [pscustomobject]@{ Card = $Card; DaTat = $DaTat; GiuQuet = $GiuQuet }
    ConvertTo-Json -InputObject $o | Set-Content -Encoding ASCII -Path $FileWifi
}

# Buoc Wi-Fi cua -Bat. Chay ca khi phan nguon dien da bat tu truoc, nen chay lai -Bat la sua duoc
# lan bam No o hop UAC.
function Enable-WifiBay {
    $card = Get-WifiCard
    if (-not $card) { '  Khong thay card Wi-Fi that nao, bo qua buoc tat quet nen.'; return }
    $cu = Read-WifiFile
    $daTat = [bool]($cu -and $cu.DaTat)
    if ($GiuQuetWifi) {
        Save-WifiFile $card $daTat $true
        "  Giu card Wi-Fi '$card' tu quet (-GiuQuetWifi)."
        return
    }
    $quet = Get-WifiTuQuet $card
    if ($null -eq $quet) {
        "  CANH BAO: khong doc duoc card '$card' co dang tu quet khong (netsh khong in tieng Anh?), bo qua."
        return
    }
    if (-not $quet) {
        Save-WifiFile $card $daTat $false
        "  Card Wi-Fi '$card' da tat quet nen tu truoc."
        return
    }
    "  Tat quet nen card Wi-Fi '$card' (hop UAC: bam Yes)..."
    $loi = Set-WifiTuQuet $card $false
    if ($loi) { "  CANH BAO: chua tat duoc quet nen: $loi"; return }
    Save-WifiFile $card $true $false
    "  Da tat quet nen card Wi-Fi '$card'. Windows se KHONG tu noi Wi-Fi nao toi khi chay -Tat."
}

# Buoc Wi-Fi cua -Tat: chi bat lai khi chinh che do bay da tat.
function Disable-WifiBay {
    $cu = Read-WifiFile
    if (-not $cu) { return }
    if ($cu.DaTat) {
        "  Bat lai quet nen card Wi-Fi '$($cu.Card)' (hop UAC: bam Yes)..."
        $loi = Set-WifiTuQuet $cu.Card $true
        if ($loi) {
            "  CANH BAO: chua bat lai duoc: $loi"
            "            Chay lai -Tat, hoac lenh admin: netsh wlan set autoconfig enabled=yes interface=`"$($cu.Card)`""
            return
        }
        "  Da bat lai: Windows lai tu noi Wi-Fi nhu truoc."
    }
    Remove-Item -Path $FileWifi
}

function Show-Status {
    $active = Get-ActiveScheme
    $sanSang = $true
    "Power scheme dang dung: $active"
    foreach ($s in $CaiDat) {
        $v = Read-Value $active $s
        if ($null -eq $v) { '  {0,-28} (scheme nay khong co)' -f $s.Ten; continue }
        $ok = ($v.Ac -eq $s.Bay -and $v.Dc -eq $s.Bay)
        if (-not $ok) { $sanSang = $false }
        '  {0,-28} cam sac {1,-6} chay pin {2,-6} {3}' -f $s.Ten, $v.Ac, $v.Dc, $(if ($ok) { 'OK' } else { '<- CHUA' })
    }
    $quetCon = $false
    $card = Get-WifiCard
    if ($card) {
        $wifi = Read-WifiFile
        $giuQuet = [bool]($wifi -and $wifi.GiuQuet)
        $quet = Get-WifiTuQuet $card
        if ($null -eq $quet) { $chu = 'khong doc duoc (netsh wlan show settings)' }
        elseif (-not $quet) { $chu = 'da tat  OK' }
        elseif ($giuQuet) { $chu = 'dang quet (giu theo -GiuQuetWifi)' }
        else { $chu = 'dang quet  <- CHUA (moi lan quet hai ESP32 mat goi vai giay)'; $quetCon = $true }
        '  {0,-28} {1}' -f "Card Wi-Fi tu quet ($card)", $chu
    }
    try {
        $null = [Windows.System.Power.PowerManager, Windows.System.Power, ContentType = WindowsRuntime]
        "  Energy Saver luc nay: $([Windows.System.Power.PowerManager]::EnergySaverStatus)  (On = dang bat: tat bang Win+A)"
    } catch {
        '  Energy Saver luc nay: khong doc duoc (xem Win+A)'
    }
    $bat = Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($bat) {
        $sac = $bat.BatteryStatus -eq 2
        "  Pin laptop: $($bat.EstimatedChargeRemaining)%  $(if ($sac) { '(dang cam sac)' } else { '(dang chay pin)' })"
        if (-not $sac -and $bat.EstimatedChargeRemaining -lt 50) { '  CANH BAO: pin laptop duoi 50% - cam sac du phong truoc khi bay.' }
    }
    if ((Test-Path $FileLuu) -and $quetCon) {
        'Trang thai: CHUA o che do bay day du - card Wi-Fi van tu quet. Chay lai -Bat, bam Yes o hop UAC (giu quet thi -Bat -GiuQuetWifi).'
    }
    elseif (Test-Path $FileLuu) { 'Trang thai: DANG o che do bay (chay -Tat de tra lai).' }
    elseif ($sanSang -and -not $quetCon) { 'Trang thai: san sang bay (cai dat da dung san, khong can -Bat).' }
    else { 'Trang thai: CHUA o che do bay - chay -Bat truoc khi ra bai.' }
}

if ($Bat -and $Tat) { throw 'Chon mot trong hai: -Bat hoac -Tat' }

if ($Bat) {
    if (Test-Path $FileLuu) {
        'Da o che do bay tu truoc (co file luu gia tri cu), khong ghi de file luu.'
    } else {
        $cu = @()
        foreach ($g in Get-Schemes) {
            foreach ($s in $CaiDat) {
                $v = Read-Value $g $s
                if ($null -ne $v) { $cu += [pscustomobject]@{ Scheme = $g; Sub = $s.Sub; Set = $s.Set; Ac = $v.Ac; Dc = $v.Dc } }
            }
        }
        New-Item -ItemType Directory -Force -Path (Split-Path $FileLuu) | Out-Null
        ConvertTo-Json -InputObject $cu -Depth 3 | Set-Content -Encoding ASCII -Path $FileLuu
        foreach ($c in $cu) {
            $s = $CaiDat | Where-Object { $_.Set -eq $c.Set } | Select-Object -First 1
            Set-Value $c.Scheme $c.Sub $c.Set $s.Bay $s.Bay
        }
        powercfg /setactive (Get-ActiveScheme)
        "Da bat che do bay tren $(@(Get-Schemes).Count) power scheme. Gia tri cu: $FileLuu"
    }
    Enable-WifiBay
} elseif ($Tat) {
    if (-not (Test-Path $FileLuu)) {
        'Khong o che do bay (khong co file luu gia tri cu), khong co gi de tra lai.'
    } else {
        $cu = Get-Content -Raw -Path $FileLuu | ConvertFrom-Json
        foreach ($c in @($cu)) { Set-Value $c.Scheme $c.Sub $c.Set ([int] $c.Ac) ([int] $c.Dc) }
        powercfg /setactive (Get-ActiveScheme)
        Remove-Item -Path $FileLuu
        'Da tra lai cai dat nguon dien nhu truoc khi bat che do bay.'
    }
    Disable-WifiBay
}
Show-Status
