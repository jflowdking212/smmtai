$oldDomain = "smmt.entreprenreducation.com"
$newDomain = "smmtai.com"
$searchPath = "c:\laragon\www\smmtai"
$extensions = @("*.ts","*.tsx","*.js","*.mjs","*.py","*.sh","*.txt","*.json","*.md","*.config.js","*.env*","*.bak")

$excludeDirs = @("node_modules",".git","dist","build",".next")

$files = Get-ChildItem -Path $searchPath -Recurse -File | Where-Object {
    $skip = $false
    foreach ($ex in $excludeDirs) {
        if ($_.FullName -match [regex]::Escape($ex)) { $skip = $true; break }
    }
    !$skip -and ($_.Extension -match '\.(ts|tsx|js|mjs|py|sh|txt|json|md|bak|env)$' -or $_.Name -match '\.env|config\.')
}

$updatedFiles = @()
foreach ($file in $files) {
    try {
        $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8
        if ($null -ne $content -and $content -match [regex]::Escape($oldDomain)) {
            $newContent = $content -replace [regex]::Escape($oldDomain), $newDomain
            Set-Content -Path $file.FullName -Value $newContent -Encoding UTF8 -NoNewline
            $updatedFiles += $file.FullName
            Write-Host "Updated: $($file.FullName)"
        }
    } catch {
        Write-Host "Error processing $($file.FullName): $_"
    }
}

Write-Host ""
Write-Host "Total files updated: $($updatedFiles.Count)"
