param(
    [string] $Package = "com/hypixel/hytale/server",
    [int] $First = 400
)

$ErrorActionPreference = "Stop"

$jar = Get-ChildItem -Path "$env:USERPROFILE\.gradle\caches\modules-2\files-2.1\com.hypixel.hytale\Server" `
    -Recurse `
    -Filter "*.jar" |
    Select-Object -First 1

if ($null -eq $jar) {
    throw "Could not find com.hypixel.hytale:Server jar in Gradle cache."
}

Write-Output "JAR: $($jar.FullName)"
Write-Output "PACKAGE: $Package"
Write-Output ""

& jar tf $jar.FullName |
    Where-Object { $_.StartsWith($Package) -and $_.EndsWith(".class") -and -not $_.Contains('$') } |
    ForEach-Object {
        $_.Replace("/", ".").Replace(".class", "")
    } |
    Sort-Object |
    Select-Object -First $First
