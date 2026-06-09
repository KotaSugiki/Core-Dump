# AI駆動開発テンプレート インストーラースクリプト
# 既存のプロジェクトに .agents フォルダを展開します。

$giteaUrl = "http://192.168.0.90:3000"
$repoOwner = "DEV_INTELLIGENT"
$repoName = "AI-Driven-Development-template"
$zipUrl = "$giteaUrl/$repoOwner/$repoName/archive/main.zip"

Write-Host "AI駆動開発テンプレートをダウンロードしています..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $zipUrl -OutFile "template.zip"

Write-Host "アーカイブを展開しています..." -ForegroundColor Cyan
Expand-Archive -Path "template.zip" -DestinationPath "template_temp"

# 展開されたフォルダ（通常はリポジトリ名のフォルダ）を検出します
$extractedDir = Get-ChildItem -Path "template_temp" -Directory | Select-Object -First 1

if ($extractedDir) {
    $srcAgents = Join-Path $extractedDir.FullName ".agents"
    if (Test-Path $srcAgents) {
        Write-Host "既存プロジェクトに .agents フォルダを配置しています..." -ForegroundColor Cyan
        Copy-Item -Path $srcAgents -Destination "." -Recurse -Force
        Write-Host "🎉 AI駆動開発のセットアップが完了しました！" -ForegroundColor Green
    } else {
        Write-Error ".agents フォルダがアーカイブ内に見つかりませんでした。"
    }
} else {
    Write-Error "アーカイブの展開に失敗しました。"
}

# 一時ファイルとZIPのクリーンアップ
Write-Host "一時ファイルをクリーンアップしています..." -ForegroundColor Gray
Remove-Item -Path "template.zip", "template_temp" -Recurse -Force
