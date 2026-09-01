' ===========================================================================
'  M1 form script — Attachments form
'  Opens the Simpro link held in ucmaSimproLink in the user's default browser.
'
'  Setup in M1 Design Mode:
'    1. Add a text box bound to ucmaSimproLink, named  txtcmaSimproLink
'    2. Add a button named                             cmdOpenSimproLink
'       Caption: "Open in Simpro"
'    3. Paste this script into the form's script editor.
'
'  NOTE: M1's scripting object model differs between versions. The two places
'  that may need adjusting for your build are marked ADJUST below.
' ===========================================================================

Function cmdOpenSimproLink_Click(sender, e)

    Dim url As String
    url = GetSimproUrl()

    If url = "" Then
        MsgBox("No Simpro link on this attachment.", vbInformation, "Simpro")
        Exit Function
    End If

    ' Only ever hand the shell an http(s) address. Without this check a value
    ' like a UNC path or a "file://" string would also be launched, and this
    ' field is written by an external application.
    If Not IsHttpUrl(url) Then
        MsgBox("This does not look like a Simpro web address:" & vbCrLf & url, _
               vbExclamation, "Simpro")
        Exit Function
    End If

    Try
        System.Diagnostics.Process.Start(url)
    Catch ex As Exception
        MsgBox("Could not open the link:" & vbCrLf & ex.Message, _
               vbCritical, "Simpro")
    End Try

End Function


' --- Reads the field value ------------------------------------------------
' ADJUST: pick whichever line matches your M1 version and delete the others.
Function GetSimproUrl() As String

    Dim value As String = ""

    Try
        ' Most common: read straight off the bound control.
        value = CStr(txtcmaSimproLink.Text)

        ' If the control is not in scope, read the field from the record instead:
        ' value = CStr(Me.Fields("ucmaSimproLink").Value)
        ' value = CStr(Form.Controls("txtcmaSimproLink").Text)
    Catch ex As Exception
        value = ""
    End Try

    If value Is Nothing Then value = ""
    Return value.Trim()

End Function


' --- Guards ---------------------------------------------------------------
Function IsHttpUrl(ByVal value As String) As Boolean

    Dim lower As String = value.ToLower()

    If lower.StartsWith("https://") Then Return True
    If lower.StartsWith("http://") Then Return True

    Return False

End Function


' ---------------------------------------------------------------------------
'  Optional: grey the button out when there is no link.
'  Call from the form's load / after-scroll event.
' ---------------------------------------------------------------------------
Function RefreshSimproButton()

    Try
        cmdOpenSimproLink.Enabled = (GetSimproUrl() <> "")
    Catch ex As Exception
        ' Button not on this form variant — nothing to do.
    End Try

End Function
