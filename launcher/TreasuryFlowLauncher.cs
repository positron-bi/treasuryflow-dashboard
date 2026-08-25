using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

namespace Positron.TreasuryFlow
{
    internal static class TreasuryFlowLauncher
    {
        [STAThread]
        private static void Main()
        {
            try
            {
                string sharedHome = AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
                string sourceRuntime = Path.Combine(sharedHome, "TreasuryFlow.runtime.v2.exe");
                if (!File.Exists(sourceRuntime))
                {
                    throw new FileNotFoundException("فایل هسته برنامه کنار راه‌انداز پیدا نشد.", sourceRuntime);
                }

                string localDir = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "Positron",
                    "TreasuryFlow"
                );
                Directory.CreateDirectory(localDir);
                string localRuntime = Path.Combine(localDir, "TreasuryFlow.runtime.v2.exe");

                FileInfo sourceInfo = new FileInfo(sourceRuntime);
                bool needsCopy = !File.Exists(localRuntime);
                if (!needsCopy)
                {
                    FileInfo localInfo = new FileInfo(localRuntime);
                    needsCopy = localInfo.Length != sourceInfo.Length
                        || localInfo.LastWriteTimeUtc != sourceInfo.LastWriteTimeUtc;
                }

                if (needsCopy)
                {
                    string pending = localRuntime + ".pending";
                    File.Copy(sourceRuntime, pending, true);
                    File.SetLastWriteTimeUtc(pending, sourceInfo.LastWriteTimeUtc);
                    if (File.Exists(localRuntime))
                    {
                        File.Replace(pending, localRuntime, null);
                    }
                    else
                    {
                        File.Move(pending, localRuntime);
                    }
                }

                ProcessStartInfo startInfo = new ProcessStartInfo
                {
                    FileName = localRuntime,
                    WorkingDirectory = sharedHome,
                    UseShellExecute = false,
                };
                startInfo.EnvironmentVariables["TREASURYFLOW_HOME"] = sharedHome;
                string localAccess = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),
                    "DashboardAccess",
                    "dashboard_users.xlsx"
                );
                string sharedAccessDir = Path.Combine(sharedHome, ".dashboard_access");
                Directory.CreateDirectory(sharedAccessDir);
                string sharedAccess = Path.Combine(sharedAccessDir, "dashboard_users.xlsx");
                if (File.Exists(localAccess))
                {
                    File.Copy(localAccess, sharedAccess, true);
                    startInfo.EnvironmentVariables["TREASURYFLOW_ACCESS_FILE"] = localAccess;
                }
                else if (File.Exists(sharedAccess))
                {
                    startInfo.EnvironmentVariables["TREASURYFLOW_ACCESS_FILE"] = sharedAccess;
                }
                else
                {
                    throw new FileNotFoundException("فایل مشترک کاربران داشبورد پیدا نشد.", sharedAccess);
                }
                string publishRepo = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),
                    "خرانه پیشبینی",
                    "treasuryflow-dashboard"
                );
                if (Directory.Exists(publishRepo))
                {
                    startInfo.EnvironmentVariables["TREASURYFLOW_PUBLISH_REPO"] = publishRepo;
                }
                Process.Start(startInfo);
            }
            catch (Exception error)
            {
                MessageBox.Show(
                    "اجرای TreasuryFlow ناموفق بود:\n\n" + error.Message,
                    "TreasuryFlow",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
            }
        }
    }
}
