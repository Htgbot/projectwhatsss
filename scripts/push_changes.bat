@echo off
echo 🚀 Pushing changes to Git...

:: Add all changes
git add .

:: Commit changes
set /p commit_msg="Enter commit message (default: 'Update project'): "
if "%commit_msg%"=="" set commit_msg="Update project"
git commit -m "%commit_msg%"

:: Push to master
git push origin master

echo ✅ Changes pushed successfully!
pause
