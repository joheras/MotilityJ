package motility;

import java.io.IOException;

import interfaces.ConfigureInterface;

public class ConfigureMotility implements ConfigureInterface{

	@Override
	public void configure() {
		// TODO Auto-generated method stub
		try {
			ScaleGUI sg = new ScaleGUI();
		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
	}

}
