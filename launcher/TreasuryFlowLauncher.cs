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
                startInfo.EnvironmentVariables["TREASURYFLOW_PUBLISH_REPO"] = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),
                    "New project",
                    "treasuryflow-dashboard"
                );
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
