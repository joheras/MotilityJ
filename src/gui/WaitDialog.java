package gui;

import java.awt.BorderLayout;
import java.awt.Dimension;
import java.awt.Toolkit;

import javax.swing.JDialog;
import javax.swing.JPanel;
import javax.swing.border.EmptyBorder;
import javax.swing.JLabel;
import javax.swing.GroupLayout;
import javax.swing.GroupLayout.Alignment;
import javax.swing.JProgressBar;

@SuppressWarnings("serial")
public class WaitDialog extends JDialog {

	private final JPanel contentPanel = new JPanel();
	private JLabel lblNewLabel;

	/**
	 * Create the dialog.
	 */
	public WaitDialog() {
		
		
	}
	
	public void makeWait() {
		setModal(true);
		setResizable(false);
		setAlwaysOnTop(true);
		setEnabled(false);
		setResizable(false);
		setTitle("Processing...");
		
		JProgressBar progressBar = new JProgressBar();
		GroupLayout groupLayout = new GroupLayout(getContentPane());
		groupLayout.setHorizontalGroup(
			groupLayout.createParallelGroup(Alignment.LEADING)
				.addGroup(groupLayout.createSequentialGroup()
					.addContainerGap()
					.addComponent(progressBar, GroupLayout.DEFAULT_SIZE, 416, Short.MAX_VALUE)
					.addContainerGap())
		);
		groupLayout.setVerticalGroup(
			groupLayout.createParallelGroup(Alignment.LEADING)
				.addGroup(groupLayout.createSequentialGroup()
					.addContainerGap()
					.addComponent(progressBar, GroupLayout.DEFAULT_SIZE, 29, Short.MAX_VALUE)
					.addContainerGap())
		);
		progressBar.setIndeterminate(true);
		
		getContentPane().setLayout(groupLayout);
		Dimension dim = Toolkit.getDefaultToolkit().getScreenSize();

		// calculate the new location of the window
		int w = this.getSize().width;
		int h = this.getSize().height;

		int x = (dim.width - w) / 2;
		int y = (dim.height - h) / 2;

		// moves this component to a new location, the top-left corner of
	    // the new location is specified by the x and y
	    // parameters in the coordinate space of this component's parent
		this.setLocation(x, y);
		pack();
		setVisible(true);
	}

}